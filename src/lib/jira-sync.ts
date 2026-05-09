import "server-only";
import { db } from "./db";
import { addKnowledgeEntries, KB_SOURCES } from "./kb";
import { recomputeMemberScores } from "./scoring";
import { fetchRepositoryCodeEvidence, type GhCodeEvidence } from "./github";
import {
  fetchIssueComments,
  fetchIssueStatusChanges,
  searchProjectIssues,
  type JiraAuth,
  type JiraIssue,
  type JiraStatusChange,
} from "./jira";
import { AC_JUDGE_VERSION, judgeAcceptanceCriteria } from "./jira-ac";

// One day in ms — used for the overdue/stale rate-limiting on
// externalIds so the same condition only fires one event per day.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;

// Cap each sync to the most-recently-updated N issues. Keeps a
// click-Sync-Now from stalling for a minute on a backlog of 200
// issues. Older ones get picked up by subsequent syncs / the cron.
const ISSUES_PER_SYNC = 25;
// Run AC judging concurrently up to this many at a time. Keeps the
// OpenAI calls from being a sequential bottleneck while staying
// well under the per-key rate limit.
const AC_JUDGE_CONCURRENCY = 5;
const CHANGELOG_CONCURRENCY = 5;

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

type GithubSourceConfig = {
  repos?: string[];
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

function buildIssuePayload(issue: JiraIssue): Record<string, unknown> {
  return {
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
}

async function fetchGithubEvidenceForIssue(
  repos: string[],
  issue: JiraIssue,
): Promise<GhCodeEvidence[]> {
  if (repos.length === 0) return [];

  const evidence: GhCodeEvidence[] = [];
  const criteriaText = [issue.summary, issue.description];
  for (const repo of repos.slice(0, 3)) {
    const [owner, name] = repo.split("/");
    if (!owner || !name) continue;
    try {
      evidence.push(
        ...(await fetchRepositoryCodeEvidence(owner, name, criteriaText, 4)),
      );
    } catch {
      // AC judgement still works from Jira text if GitHub evidence is unavailable.
    }
  }

  return evidence.slice(0, 8);
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

  const githubSource = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });
  const githubRepos =
    (githubSource?.configJson as GithubSourceConfig | null)?.repos ?? [];

  let allIssues: JiraIssue[];
  try {
    allIssues = await searchProjectIssues(ctx.auth, ctx.projectKey);
  } catch (err) {
    summary.errors.push(
      err instanceof Error ? err.message : "Jira search failed",
    );
    return summary;
  }
  // Issues come back sorted by `updated DESC` from the JQL ORDER BY,
  // so the slice keeps the freshest ones — exactly what the user
  // is most likely to be looking at after moving a ticket.
  const issues = allIssues.slice(0, ISSUES_PER_SYNC);
  summary.scanned = allIssues.length;

  // Map Jira accountId -> GPR userId once.
  const identities = await db.sourceIdentity.findMany({
    where: { projectId, sourceType: "JIRA" },
    include: { projectMember: true },
  });
  const accountIdToUserId = new Map(
    identities.map((i) => [i.externalId, i.projectMember.userId]),
  );

  // Pull the most recent event we already have per Jira issue.
  // Tracking both the status name and the status category lets us
  // detect transitions INTO Done (so we re-judge AC) without
  // double-firing on cosmetic changes.
  const priorEvents = await db.contributionEvent.findMany({
    where: { projectId, sourceType: "JIRA" },
    orderBy: { occurredAt: "desc" },
  });
  const lastSeenByIssueId = new Map<
    string,
    { status: string; statusCategory: string; occurredAt: Date }
  >();
  const lastCompletionByIssueId = new Map<
    string,
    {
      id: string;
      eventType: string;
      judgeVersion: number;
      payload: Record<string, unknown>;
    }
  >();
  for (const ev of priorEvents) {
    const payload = ev.payloadJson as {
      issueId?: string;
      status?: string | null;
      statusCategory?: string;
      acJudgeVersion?: number;
    };
    if (!payload.issueId) continue;
    if (!lastSeenByIssueId.has(payload.issueId)) {
      lastSeenByIssueId.set(payload.issueId, {
        status: payload.status ?? "",
        statusCategory: payload.statusCategory ?? "",
        occurredAt: ev.occurredAt,
      });
    }
    if (
      !lastCompletionByIssueId.has(payload.issueId) &&
      (ev.eventType === "issue_completed" ||
        ev.eventType === "issue_completed_ac_failed")
    ) {
      lastCompletionByIssueId.set(payload.issueId, {
        id: ev.id,
        eventType: ev.eventType,
        judgeVersion:
          typeof payload.acJudgeVersion === "number"
            ? payload.acJudgeVersion
            : 0,
        payload: payload as Record<string, unknown>,
      });
    }
  }

  // Pre-judge AC in parallel for every issue currently in Done that
  // wasn't already in Done last time we saw it. AI handles AC
  // identification in any format, so no regex pre-parse is needed.
  type AcVerdict = Awaited<ReturnType<typeof judgeAcceptanceCriteria>>;
  const acVerdictByIssueId = new Map<string, AcVerdict>();

  const judgeQueue: JiraIssue[] = [];
  for (const issue of issues) {
    if (issue.statusCategory !== "done") continue;
    const prior = lastSeenByIssueId.get(issue.id);
    // First time we've seen this issue, OR it just transitioned
    // INTO Done — both warrant a fresh AC judgement.
    const isFreshlyDone = !prior || prior.statusCategory !== "done";
    const lastCompletion = lastCompletionByIssueId.get(issue.id);
    const needsJudgeRefresh =
      !isFreshlyDone &&
      Boolean(lastCompletion) &&
      (lastCompletion?.judgeVersion ?? 0) < AC_JUDGE_VERSION;
    if (isFreshlyDone || needsJudgeRefresh) judgeQueue.push(issue);
  }

  for (let i = 0; i < judgeQueue.length; i += AC_JUDGE_CONCURRENCY) {
    const batch = judgeQueue.slice(i, i + AC_JUDGE_CONCURRENCY);
    await Promise.all(
      batch.map(async (issue) => {
        try {
          const [comments, githubEvidence] = await Promise.all([
            fetchIssueComments(ctx.auth, issue.key),
            fetchGithubEvidenceForIssue(githubRepos, issue),
          ]);
          const verdict = await judgeAcceptanceCriteria({
            issueKey: issue.key,
            summary: issue.summary,
            description: issue.description,
            comments,
            githubEvidence,
          });
          acVerdictByIssueId.set(issue.id, verdict);
        } catch (err) {
          summary.errors.push(
            `AC judge failed for ${issue.key}: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
      }),
    );
  }

  const statusChangesByIssueId = new Map<string, JiraStatusChange[]>();
  for (let i = 0; i < issues.length; i += CHANGELOG_CONCURRENCY) {
    const batch = issues.slice(i, i + CHANGELOG_CONCURRENCY);
    await Promise.all(
      batch.map(async (issue) => {
        const prior = lastSeenByIssueId.get(issue.id);
        if (prior && prior.status === issue.statusName) return;
        try {
          const changes = await fetchIssueStatusChanges(ctx.auth, issue.key);
          statusChangesByIssueId.set(issue.id, changes);
        } catch (err) {
          summary.errors.push(
            `Jira changelog failed for ${issue.key}: ${err instanceof Error ? err.message : "unknown"}`,
          );
        }
      }),
    );
  }

  for (const issue of issues) {
    const userId = issue.assigneeAccountId
      ? (accountIdToUserId.get(issue.assigneeAccountId) ?? null)
      : null;

    const basePayload = buildIssuePayload(issue);

    const prior = lastSeenByIssueId.get(issue.id);

    try {
      if (!prior) {
        const wrote = await writeEvent(source.id, projectId, {
          externalId: `created:${issue.id}`,
          eventType: "issue_created",
          payload: basePayload,
          userId,
          occurredAt: new Date(issue.created),
        });
        if (wrote) summary.created += 1;
      }

      const changes = statusChangesByIssueId.get(issue.id) ?? [];
      let wroteStatusChange = false;
      for (const change of changes) {
        if (!change.fromStatus || change.fromStatus === change.toStatus) continue;
        const changedAtMs = Date.parse(change.changedAt);
        if (Number.isNaN(changedAtMs)) continue;
        if (prior && changedAtMs <= prior.occurredAt.getTime()) continue;
        const wrote = await writeEvent(source.id, projectId, {
          externalId: `updated:${issue.id}:${change.changedAt}:${change.fromStatus}:${change.toStatus}`,
          eventType: "issue_updated",
          payload: {
            ...basePayload,
            status: change.toStatus,
            previousStatus: change.fromStatus,
          },
          userId,
          occurredAt: new Date(change.changedAt),
        });
        if (wrote) {
          wroteStatusChange = true;
          summary.updated += 1;
        }
      }

      if (
        prior &&
        prior.status &&
        prior.status !== issue.statusName &&
        !wroteStatusChange
      ) {
        const wrote = await writeEvent(source.id, projectId, {
          externalId: `updated:${issue.id}:${issue.updated}`,
          eventType: "issue_updated",
          payload: { ...basePayload, previousStatus: prior.status },
          userId,
          occurredAt: new Date(issue.updated),
        });
        if (wrote) summary.updated += 1;
      }

      // Completion fires on every transition INTO Done (including
      // the first sight of an already-Done issue). External ID is
      // scoped by `updated` so a Done → In Progress → Done cycle
      // produces a fresh completed event with a fresh AC verdict.
      const isFreshlyDone =
        issue.statusCategory === "done" &&
        (!prior || prior.statusCategory !== "done");
      const isJudgeRefresh =
        issue.statusCategory === "done" &&
        acVerdictByIssueId.has(issue.id) &&
        !isFreshlyDone;
      if (isFreshlyDone || isJudgeRefresh) {
        const acVerdict = acVerdictByIssueId.get(issue.id) ?? null;

        const acPayload = acVerdict
          ? {
              acJudgeVersion: AC_JUDGE_VERSION,
              acHasAc: acVerdict.hasAc,
              acAllMet: acVerdict.allMet,
              acSummary: acVerdict.summary,
              acJudgements: acVerdict.judgements,
            }
          : {};

        const acFailed =
          acVerdict !== null && acVerdict.hasAc && !acVerdict.allMet;
        const eventType = acFailed
          ? "issue_completed_ac_failed"
          : "issue_completed";
        const completionPayload = { ...basePayload, ...acPayload };
        const existingCompletion = lastCompletionByIssueId.get(issue.id);

        if (isJudgeRefresh && existingCompletion) {
          await db.contributionEvent.update({
            where: { id: existingCompletion.id },
            data: {
              eventType,
              payloadJson: completionPayload as never,
              userId,
              weight: EVENT_WEIGHTS[eventType] ?? 0,
              occurredAt: new Date(issue.updated),
            },
          });

          if (
            !acFailed &&
            existingCompletion.eventType === "issue_completed_ac_failed"
          ) {
            await db.card.deleteMany({
              where: {
                projectId,
                cardType: "YELLOW",
                reason: {
                  contains: `Jira ticket ${issue.key} marked Done`,
                },
              },
            });
          }
        } else {
          const wrote = await writeEvent(source.id, projectId, {
            externalId: `completed:${issue.id}:${issue.updated}`,
            eventType,
            payload: completionPayload,
            userId,
            occurredAt: new Date(issue.updated),
          });
          if (wrote) summary.completed += 1;
        }

        const shouldCreateAcCard =
          acFailed &&
          userId &&
          acVerdict &&
          (!isJudgeRefresh ||
            existingCompletion?.eventType !== "issue_completed_ac_failed");

        if (shouldCreateAcCard) {
          await db.card.create({
            data: {
              projectId,
              userId: userId!,
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

  const recentIssueIds = new Set(issues.map((issue) => issue.id));
  const fullScanOverdueIssues = allIssues.filter(
    (issue) => !recentIssueIds.has(issue.id) && isOverdue(issue),
  );

  for (const issue of fullScanOverdueIssues) {
    const userId = issue.assigneeAccountId
      ? (accountIdToUserId.get(issue.assigneeAccountId) ?? null)
      : null;
    const basePayload = buildIssuePayload(issue);

    try {
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
    } catch (err) {
      summary.errors.push(
        `Overdue issue ${issue.key}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  // Mirror noteworthy events into the KB so Ask GPR sees them too.
  if (summary.created + summary.completed + summary.overdue > 0) {
    const noteworthyById = new Map<string, JiraIssue>();
    for (const i of issues) {
      if (
        i.statusCategory === "done" ||
        isOverdue(i) ||
        !lastSeenByIssueId.has(i.id)
      ) {
        noteworthyById.set(i.id, i);
      }
    }
    for (const i of fullScanOverdueIssues) {
      noteworthyById.set(i.id, i);
    }
    const noteworthy = [...noteworthyById.values()];
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
