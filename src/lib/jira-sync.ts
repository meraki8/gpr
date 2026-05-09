import "server-only";
import { db } from "./db";
import { addKnowledgeEntries, KB_SOURCES } from "./kb";
import { recomputeMemberScores } from "./scoring";
import {
  fetchIssueComments,
  searchProjectIssues,
  type JiraAuth,
  type JiraIssue,
} from "./jira";
import { judgeAcceptanceCriteria, parseAcceptanceCriteria } from "./jira-ac";

// One day in ms — used for the overdue/stale rate-limiting on
// externalIds so the same condition only fires one event per day.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;

const EVENT_WEIGHTS: Record<string, number> = {
  issue_created: 0.5,
  issue_updated: 0.5,
  issue_completed: 2.0,
  issue_completed_ac_failed: 0, // No points and a card
  issue_overdue: 0,
  issue_stale: 0,
};

type JiraSourceConfig = {
  projectKey?: string;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  webhookSecret?: string;
};

function configToAuth(config: JiraSourceConfig): {
  auth: JiraAuth;
  projectKey: string;
} | null {
  if (!config.baseUrl || !config.email || !config.apiToken || !config.projectKey) {
    return null;
  }
  return {
    auth: {
      baseUrl: config.baseUrl,
      email: config.email,
      apiToken: config.apiToken,
    },
    projectKey: config.projectKey,
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(issue: JiraIssue): boolean {
  if (!issue.dueDate) return false;
  if (issue.statusCategory === "done") return false;
  const due = Date.parse(issue.dueDate);
  if (Number.isNaN(due)) return false;
  return due < Date.now();
}

function isStale(issue: JiraIssue): boolean {
  if (issue.statusCategory === "done") return false;
  const updated = Date.parse(issue.updated);
  if (Number.isNaN(updated)) return false;
  return Date.now() - updated > STALE_DAYS * ONE_DAY_MS;
}

export type JiraSyncSummary = {
  projectId: string;
  scanned: number;
  created: number;
  updated: number;
  completed: number;
  acFailed: number;
  overdue: number;
  stale: number;
  errors: string[];
};

// Pulls every Jira issue for a project, diffs against the events
// already stored, and writes new ContributionEvents for transitions
// (created / status change / completion / overdue / stale). On
// completion it also runs the AC judge — if the AI thinks an
// acceptance criterion is unmet, it auto-issues a yellow card.
export async function syncJiraProject(
  projectId: string,
): Promise<JiraSyncSummary> {
  const summary: JiraSyncSummary = {
    projectId,
    scanned: 0,
    created: 0,
    updated: 0,
    completed: 0,
    acFailed: 0,
    overdue: 0,
    stale: 0,
    errors: [],
  };

  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "JIRA" } },
  });
  if (!source || !source.enabled) {
    summary.errors.push("Jira source not configured");
    return summary;
  }

  const ctx = configToAuth(source.configJson as JiraSourceConfig);
  if (!ctx) {
    summary.errors.push(
      "Jira source missing API credentials — reconnect with API token",
    );
    return summary;
  }

  let issues: JiraIssue[];
  try {
    issues = await searchProjectIssues(ctx.auth, ctx.projectKey);
  } catch (err) {
    summary.errors.push(
      err instanceof Error ? err.message : "Jira search failed",
    );
    return summary;
  }
  summary.scanned = issues.length;

  // Map Jira accountId -> GPR userId once.
  const identities = await db.sourceIdentity.findMany({
    where: { projectId, sourceType: "JIRA" },
    include: { projectMember: true },
  });
  const accountIdToUserId = new Map(
    identities.map((i) => [i.externalId, i.projectMember.userId]),
  );

  // Pull the most recent event we already have per Jira issue.
  // Storing this in payloadJson.issueId so we can find prior status.
  const priorEvents = await db.contributionEvent.findMany({
    where: { projectId, sourceType: "JIRA" },
    orderBy: { occurredAt: "desc" },
  });
  const lastSeenByIssueId = new Map<string, { status: string; eventType: string }>();
  for (const ev of priorEvents) {
    const payload = ev.payloadJson as {
      issueId?: string;
      status?: string | null;
    };
    if (!payload.issueId) continue;
    if (!lastSeenByIssueId.has(payload.issueId)) {
      lastSeenByIssueId.set(payload.issueId, {
        status: payload.status ?? "",
        eventType: ev.eventType,
      });
    }
  }

  // Track the issue IDs we've already emitted a "completed" event
  // for so we don't pay for the AC judge twice on rapid syncs.
  const completedIssueIds = new Set<string>();
  for (const ev of priorEvents) {
    if (ev.eventType === "issue_completed") {
      const payload = ev.payloadJson as { issueId?: string };
      if (payload.issueId) completedIssueIds.add(payload.issueId);
    }
  }

  for (const issue of issues) {
    const userId = issue.assigneeAccountId
      ? (accountIdToUserId.get(issue.assigneeAccountId) ?? null)
      : null;

    const basePayload = {
      issueId: issue.id,
      issueKey: issue.key,
      summary: issue.summary,
      title: `[${issue.key}] ${issue.summary}`,
      status: issue.statusName,
      statusCategory: issue.statusCategory,
      assigneeAccountId: issue.assigneeAccountId,
      assigneeDisplayName: issue.assigneeDisplayName,
      login: issue.assigneeDisplayName ?? null,
      dueDate: issue.dueDate,
      priority: issue.priority,
      url: issue.url,
      sprintActiveName: issue.sprintActiveName,
      sprintNames: issue.sprintNames,
    };

    const prior = lastSeenByIssueId.get(issue.id);

    try {
      if (!prior) {
        await writeEvent(source.id, projectId, {
          externalId: `created:${issue.id}`,
          eventType: "issue_created",
          payload: basePayload,
          userId,
          occurredAt: new Date(issue.created),
        });
        summary.created += 1;
      } else if (prior.status && prior.status !== issue.statusName) {
        await writeEvent(source.id, projectId, {
          externalId: `updated:${issue.id}:${issue.updated}`,
          eventType: "issue_updated",
          payload: { ...basePayload, previousStatus: prior.status },
          userId,
          occurredAt: new Date(issue.updated),
        });
        summary.updated += 1;
      }

      // Completion is the moment we score the AC.
      if (
        issue.statusCategory === "done" &&
        !completedIssueIds.has(issue.id)
      ) {
        const acItems = parseAcceptanceCriteria(issue.description);
        let acVerdict = null as Awaited<ReturnType<typeof judgeAcceptanceCriteria>> | null;
        if (acItems.length > 0) {
          try {
            const comments = await fetchIssueComments(ctx.auth, issue.key);
            acVerdict = await judgeAcceptanceCriteria({
              issueKey: issue.key,
              summary: issue.summary,
              description: issue.description,
              acItems,
              comments,
            });
          } catch (err) {
            summary.errors.push(
              `AC judge failed for ${issue.key}: ${err instanceof Error ? err.message : "unknown"}`,
            );
          }
        }

        const acPayload = acVerdict
          ? {
              acItems: acItems.map((ac) => ({
                text: ac.text,
                selfReportedDone: ac.selfReportedDone,
              })),
              acAllMet: acVerdict.allMet,
              acSummary: acVerdict.summary,
              acJudgements: acVerdict.judgements,
            }
          : { acItems: acItems.map((ac) => ({ text: ac.text, selfReportedDone: ac.selfReportedDone })) };

        const acFailed = acVerdict !== null && !acVerdict.allMet;

        await writeEvent(source.id, projectId, {
          externalId: `completed:${issue.id}`,
          eventType: acFailed ? "issue_completed_ac_failed" : "issue_completed",
          payload: { ...basePayload, ...acPayload },
          userId,
          occurredAt: new Date(issue.updated),
        });
        completedIssueIds.add(issue.id);
        summary.completed += 1;

        if (acFailed && userId && acVerdict) {
          await db.card.create({
            data: {
              projectId,
              userId,
              cardType: "YELLOW",
              reason: `Jira ticket ${issue.key} marked Done but acceptance criteria not met: "${issue.summary}"`,
              evidenceJson: {
                issueKey: issue.key,
                summary: issue.summary,
                url: issue.url,
                acSummary: acVerdict.summary,
                judgements: acVerdict.judgements,
              },
            },
          });
          summary.acFailed += 1;
        }
      }

      if (isOverdue(issue)) {
        const wrote = await writeEvent(source.id, projectId, {
          externalId: `overdue:${issue.id}:${todayKey()}`,
          eventType: "issue_overdue",
          payload: basePayload,
          userId,
          occurredAt: new Date(),
        });
        if (wrote) {
          summary.overdue += 1;
          if (userId) {
            await db.card.create({
              data: {
                projectId,
                userId,
                cardType: "YELLOW",
                reason: `Jira ticket ${issue.key} is overdue: "${issue.summary}"`,
                evidenceJson: {
                  issueKey: issue.key,
                  summary: issue.summary,
                  dueDate: issue.dueDate,
                  url: issue.url,
                },
              },
            });
          }
        }
      }

      if (isStale(issue)) {
        const wrote = await writeEvent(source.id, projectId, {
          externalId: `stale:${issue.id}:${todayKey()}`,
          eventType: "issue_stale",
          payload: basePayload,
          userId,
          occurredAt: new Date(),
        });
        if (wrote) summary.stale += 1;
      }
    } catch (err) {
      summary.errors.push(
        `Issue ${issue.key}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  // Mirror noteworthy events into the KB so Ask GPR sees them too.
  if (summary.created + summary.completed + summary.overdue > 0) {
    const noteworthy = issues.filter(
      (i) =>
        i.statusCategory === "done" ||
        isOverdue(i) ||
        !lastSeenByIssueId.has(i.id),
    );
    if (noteworthy.length > 0) {
      await addKnowledgeEntries(
        noteworthy.map((i) => ({
          projectId,
          source: KB_SOURCES.JIRA,
          sourceRefId: `jira:${i.id}`,
          sourceTypeLabel: i.statusName,
          title: `[${i.key}] ${i.summary}`,
          assignedTo: i.assigneeDisplayName ?? null,
          targetDate: i.dueDate ? new Date(i.dueDate) : null,
          content: [
            `Status: ${i.statusName}`,
            i.assigneeDisplayName ? `Assignee: ${i.assigneeDisplayName}` : null,
            i.dueDate ? `Due: ${i.dueDate}` : null,
            i.sprintActiveName ? `Sprint: ${i.sprintActiveName}` : null,
            i.url,
          ]
            .filter(Boolean)
            .join("\n"),
        })),
      );
    }
  }

  await db.contributionSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  try {
    await recomputeMemberScores(projectId, "jira sync");
  } catch (err) {
    summary.errors.push(
      `Score recompute: ${err instanceof Error ? err.message : "failed"}`,
    );
  }

  return summary;
}

async function writeEvent(
  sourceId: string,
  projectId: string,
  ev: {
    externalId: string;
    eventType: string;
    payload: Record<string, unknown>;
    userId: string | null;
    occurredAt: Date;
  },
): Promise<boolean> {
  const result = await db.contributionEvent.createMany({
    data: [
      {
        projectId,
        sourceId,
        sourceType: "JIRA",
        externalId: ev.externalId,
        eventType: ev.eventType,
        payloadJson: ev.payload as never,
        userId: ev.userId,
        weight: EVENT_WEIGHTS[ev.eventType] ?? 0,
        occurredAt: ev.occurredAt,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}
