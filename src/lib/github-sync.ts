import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ai, AI_MODEL } from "./ai";
import {
  fetchCommitFiles,
  fetchCommits,
  fetchPullRequestFiles,
  fetchPullRequests,
  type GhChangedFile,
  type GhCommit,
  type GhPullRequest,
} from "./github";
import {
  markIssueDescriptionTasksDone,
  searchProjectIssues,
  transitionIssueTo,
  type JiraAuth,
  type JiraIssue,
  type JiraTransitionResult,
} from "./jira";
import { KB_SOURCES, addKnowledgeEntries } from "./kb";
import { recomputeMemberScores } from "./scoring";

type GithubSourceConfig = {
  repos?: string[];
  accessToken?: string;
  token?: string;
  lastSyncError?: string | null;
  lastSyncOkAt?: string | null;
};

type JiraSourceConfig = {
  projectKey?: string;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
};

export type GithubSyncSummary = {
  projectId: string;
  repos: number;
  commits: number;
  pullRequests: number;
  jiraAutoProgressed: number;
  jiraAutoDone: number;
  jiraStatusFailures: number;
  jiraDoneFailures: number;
  errors: string[];
};

type JiraIssueContext = {
  auth: JiraAuth;
  projectKey: string;
  issues: JiraIssue[];
  issuesByKey: Map<string, JiraIssue>;
};

type JiraAutomationResult = {
  needed: boolean;
  actionTaken: boolean;
  failed: boolean;
  warning?: string;
};

const JIRA_PROGRESS_RECHECK_MS = 24 * 60 * 60 * 1000;

function jiraConfigToAuth(config: JiraSourceConfig | null): {
  auth: JiraAuth;
  projectKey: string;
} | null {
  if (!config?.baseUrl || !config.email || !config.apiToken || !config.projectKey) {
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

function issueNeedsProgress(issue: JiraIssue): boolean {
  if (issue.statusCategory === "done") return false;
  if (issue.statusCategory === "indeterminate") return false;
  return issue.statusCategory === "new" || /^(to do|todo|backlog)$/i.test(issue.statusName);
}

function issueNeedsDone(issue: JiraIssue): boolean {
  return issue.statusCategory !== "done";
}

async function maybeLoadJiraIssueMap(
  projectId: string,
): Promise<JiraIssueContext | null> {
  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "JIRA" } },
  });
  if (!source?.enabled) return null;

  const ctx = jiraConfigToAuth(source.configJson as JiraSourceConfig | null);
  if (!ctx) return null;

  const issues = await searchProjectIssues(ctx.auth, ctx.projectKey);
  return {
    auth: ctx.auth,
    projectKey: ctx.projectKey.toUpperCase(),
    issues,
    issuesByKey: new Map(issues.map((issue) => [issue.key.toUpperCase(), issue])),
  };
}

function transitionPayload(result: JiraTransitionResult): Prisma.InputJsonObject {
  if (result.ok) {
    return {
      transitionId: result.transitionId,
      transitionName: result.transitionName,
      transitionedTo: result.toStatus,
    };
  }
  return {
    transitionError: result.reason,
    availableTransitions: result.availableTransitions,
  };
}

function filesToDiffEvidence(files: GhChangedFile[]): string {
  return files
    .slice(0, 20)
    .map((file, i) =>
      [
        `FILE ${i + 1}: ${file.filename}`,
        `status=${file.status ?? "unknown"} additions=${file.additions ?? 0} deletions=${file.deletions ?? 0}`,
        file.patch ? file.patch.slice(0, 2500) : "(no patch available)",
      ].join("\n"),
    )
    .join("\n\n---\n\n")
    .slice(0, 18_000);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForDirectMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function directJiraMatchFromDiff(
  issues: JiraIssue[],
  diffEvidence: string,
): { issue: JiraIssue; confidence: number; reason: string } | null {
  const upperDiff = diffEvidence.toUpperCase();
  const normalizedDiff = normalizeForDirectMatch(diffEvidence);

  for (const issue of issues) {
    const keyPattern = new RegExp(
      `(^|[^A-Z0-9])${escapeRegExp(issue.key.toUpperCase())}([^A-Z0-9]|$)`,
    );
    if (keyPattern.test(upperDiff)) {
      return {
        issue,
        confidence: 0.98,
        reason: `Changed file diff contains Jira key ${issue.key}.`,
      };
    }
  }

  for (const issue of issues) {
    const normalizedSummary = normalizeForDirectMatch(issue.summary);
    if (
      normalizedSummary.length >= 20 &&
      normalizedSummary.split(" ").length >= 3 &&
      normalizedDiff.includes(normalizedSummary)
    ) {
      return {
        issue,
        confidence: 0.95,
        reason: `Changed file diff contains the Jira story summary for ${issue.key}.`,
      };
    }
  }

  return null;
}

function jiraCandidates(issues: JiraIssue[]): string {
  return issues
    .slice(0, 80)
    .map((issue) =>
      [
        `KEY: ${issue.key}`,
        `STATUS: ${issue.statusName} (${issue.statusCategory})`,
        `SUMMARY: ${issue.summary}`,
        `DESCRIPTION: ${issue.description.slice(0, 900) || "(empty)"}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

async function matchJiraIssueFromCode(input: {
  jira: { projectKey: string; issues: JiraIssue[] } | null;
  repo: string;
  changeLabel: string;
  files: GhChangedFile[];
}): Promise<{ issue: JiraIssue | null; confidence: number; reason: string }> {
  if (!input.jira || input.files.length === 0) {
    return { issue: null, confidence: 0, reason: "No Jira or code diff available." };
  }

  const diffEvidence = filesToDiffEvidence(input.files);
  const directMatch = directJiraMatchFromDiff(input.jira.issues, diffEvidence);
  if (directMatch) return directMatch;

  const prompt = [
    `Match a GitHub change to the Jira user story it is implementing.`,
    `Use ONLY the changed file paths and diff content below. Do not use commit messages, PR titles, branch names, or Jira keys outside the diff content.`,
    `Diff content can include source code, tests, README/Markdown, docs, config, data files, or other project files.`,
    `A README or documentation-only change can match a Jira story if the diff content clearly describes work on that story.`,
    `Choose at most one Jira issue. If the diff content does not clearly correspond to any listed story, return issueKey=null and confidence=0.`,
    `Return confidence from 0 to 1. Use >=0.65 only when the changed paths or diff content strongly match the story intent.`,
    ``,
    `REPO: ${input.repo}`,
    `CHANGE: ${input.changeLabel}`,
    ``,
    `CHANGED FILE DIFF:`,
    diffEvidence,
    ``,
    `JIRA CANDIDATES:`,
    jiraCandidates(input.jira.issues),
    ``,
    `Respond as JSON:`,
    `{ "issueKey": "ABC-123" | null, "confidence": 0.0, "reason": "short explanation based on changed paths or diff content" }`,
  ].join("\n");

  try {
    const completion = await ai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      issueKey?: string | null;
      confidence?: number;
      reason?: string;
    };
    const key = parsed.issueKey?.toUpperCase() ?? null;
    const confidence =
      typeof parsed.confidence === "number" ? parsed.confidence : 0;
    if (!key || confidence < 0.65) {
      return {
        issue: null,
        confidence,
        reason: parsed.reason ?? "No confident Jira match.",
      };
    }
    return {
      issue: input.jira.issues.find((issue) => issue.key.toUpperCase() === key) ?? null,
      confidence,
      reason: parsed.reason ?? "Matched from code diff.",
    };
  } catch (err) {
    return {
      issue: null,
      confidence: 0,
      reason: err instanceof Error ? err.message : "Jira match failed.",
    };
  }
}

async function checkCommitJiraProgress(input: {
  projectId: string;
  sourceId: string;
  repo: string;
  commit: GhCommit;
  files: GhChangedFile[];
  userId: string | null;
  jira: JiraIssueContext | null;
}): Promise<JiraAutomationResult> {
  if (!input.jira) {
    return { needed: false, actionTaken: false, failed: false };
  }

  const match = await matchJiraIssueFromCode({
    jira: input.jira,
    repo: input.repo,
    changeLabel: `commit ${input.commit.sha.slice(0, 7)}`,
    files: input.files,
  });
  const issue = match.issue;
  if (!issue || !issueNeedsProgress(issue)) {
    return { needed: false, actionTaken: false, failed: false };
  }

  const transition = await transitionIssueTo(
    input.jira.auth,
    issue.key,
    "in_progress",
  );
  const transitioned = transition.ok;

  const externalId = `jira-progress:${input.commit.sha}:${issue.key}`;
  const result = await db.contributionEvent.createMany({
    data: [
      {
        projectId: input.projectId,
        sourceId: input.sourceId,
        sourceType: "GITHUB",
        externalId,
        eventType: transitioned
          ? "jira_auto_in_progress"
          : "jira_progress_transition_failed",
        payloadJson: {
          title: transitioned
            ? `Moved ${issue.key} to In Progress`
            : `Could not move ${issue.key} to In Progress`,
          repo: input.repo,
          sha: input.commit.sha,
          login: input.commit.author?.login ?? null,
          url: input.commit.html_url,
          issueKey: issue.key,
          issueStatus: issue.statusName,
          issueUrl: issue.url,
          action: "move_to_in_progress",
          transitioned,
          ...transitionPayload(transition),
          matchConfidence: match.confidence,
          matchReason: match.reason,
          files: input.files.slice(0, 10).map((f) => f.filename),
        },
        userId: input.userId,
        weight: 0,
        occurredAt: new Date(input.commit.commit.author?.date ?? Date.now()),
      },
    ],
    skipDuplicates: true,
  });

  if (result.count === 0) {
    return {
      needed: true,
      actionTaken: transitioned,
      failed: !transitioned,
    };
  }

  if (!transitioned && input.userId) {
    await db.card.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        cardType: "YELLOW",
        reason: `Commit appears to work on Jira ticket ${issue.key}, but it is still in "${issue.statusName}" instead of In Progress: "${issue.summary}"`,
        evidenceJson: {
          repo: input.repo,
          sha: input.commit.sha,
          commitUrl: input.commit.html_url,
          issueKey: issue.key,
          issueStatus: issue.statusName,
          issueUrl: issue.url,
          summary: issue.summary,
          transitionError: transition.ok ? null : transition.reason,
          availableTransitions: transition.ok
            ? []
            : transition.availableTransitions,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          files: input.files.slice(0, 10).map((f) => f.filename),
        },
      },
    });
  }

  return {
    needed: true,
    actionTaken: transitioned,
    failed: !transitioned,
  };
}

async function checkMergedPrJiraDone(input: {
  projectId: string;
  sourceId: string;
  repo: string;
  pullRequest: GhPullRequest;
  files: GhChangedFile[];
  userId: string | null;
  jira: JiraIssueContext | null;
}): Promise<JiraAutomationResult> {
  if (!input.jira || !input.pullRequest.merged_at) {
    return { needed: false, actionTaken: false, failed: false };
  }
  const mergedAtMs = Date.parse(input.pullRequest.merged_at);
  if (Number.isNaN(mergedAtMs)) {
    return { needed: false, actionTaken: false, failed: false };
  }
  if (Date.now() - mergedAtMs < 6 * 60 * 60 * 1000) {
    return { needed: false, actionTaken: false, failed: false };
  }

  const match = await matchJiraIssueFromCode({
    jira: input.jira,
    repo: input.repo,
    changeLabel: `merged PR #${input.pullRequest.number}`,
    files: input.files,
  });
  const issue = match.issue;
  if (!issue || !issueNeedsDone(issue)) {
    return { needed: false, actionTaken: false, failed: false };
  }

  let progressTransition: JiraTransitionResult | null = null;
  let doneTransition = await transitionIssueTo(input.jira.auth, issue.key, "done");
  if (!doneTransition.ok && issueNeedsProgress(issue)) {
    progressTransition = await transitionIssueTo(
      input.jira.auth,
      issue.key,
      "in_progress",
    );
    if (progressTransition.ok) {
      doneTransition = await transitionIssueTo(input.jira.auth, issue.key, "done");
    }
  }

  const transitioned = doneTransition.ok;
  let checkboxResult:
    | Awaited<ReturnType<typeof markIssueDescriptionTasksDone>>
    | null = null;
  if (transitioned) {
    checkboxResult = await markIssueDescriptionTasksDone(
      input.jira.auth,
      issue.key,
      issue.descriptionAdf,
    );
  }

  const externalId = `jira-done:${input.repo}:${input.pullRequest.number}:${issue.key}`;
  const result = await db.contributionEvent.createMany({
    data: [
      {
        projectId: input.projectId,
        sourceId: input.sourceId,
        sourceType: "GITHUB",
        externalId,
        eventType: transitioned
          ? "jira_auto_done_after_merge"
          : "jira_done_transition_failed",
        payloadJson: {
          title: transitioned
            ? `Moved ${issue.key} to Done`
            : `Could not move ${issue.key} to Done`,
          repo: input.repo,
          number: input.pullRequest.number,
          login: input.pullRequest.user?.login ?? null,
          url: input.pullRequest.html_url,
          mergedAt: input.pullRequest.merged_at,
          issueKey: issue.key,
          issueStatus: issue.statusName,
          issueUrl: issue.url,
          action: "move_to_done",
          transitioned,
          ...(progressTransition
            ? {
                progressTransition: transitionPayload(progressTransition),
              }
            : {}),
          doneTransition: transitionPayload(doneTransition),
          checkboxesUpdated: checkboxResult?.updated ?? false,
          checkboxUpdateError:
            checkboxResult && !checkboxResult.ok ? checkboxResult.reason : null,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          files: input.files.slice(0, 20).map((f) => f.filename),
        },
        userId: input.userId,
        weight: 0,
        occurredAt: new Date(input.pullRequest.merged_at),
      },
    ],
    skipDuplicates: true,
  });

  const warning =
    checkboxResult && !checkboxResult.ok
      ? checkboxResult.reason
      : undefined;

  if (result.count === 0) {
    return {
      needed: true,
      actionTaken: transitioned,
      failed: !transitioned,
      warning,
    };
  }

  if (!transitioned && input.userId) {
    await db.card.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        cardType: "YELLOW",
        reason: `PR #${input.pullRequest.number} was merged more than 6 hours ago, but Jira ticket ${issue.key} is still in "${issue.statusName}" instead of Done: "${issue.summary}"`,
        evidenceJson: {
          repo: input.repo,
          pullRequest: input.pullRequest.number,
          prUrl: input.pullRequest.html_url,
          mergedAt: input.pullRequest.merged_at,
          issueKey: issue.key,
          issueStatus: issue.statusName,
          issueUrl: issue.url,
          summary: issue.summary,
          doneTransition: transitionPayload(doneTransition),
          progressTransition: progressTransition
            ? transitionPayload(progressTransition)
            : null,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          files: input.files.slice(0, 20).map((f) => f.filename),
        },
      },
    });
  }

  return {
    needed: true,
    actionTaken: transitioned,
    failed: !transitioned,
    warning,
  };
}

export async function syncGithubProject(
  projectId: string,
): Promise<GithubSyncSummary> {
  console.log("[syncGithubProject] enter:", { projectId });
  const summary: GithubSyncSummary = {
    projectId,
    repos: 0,
    commits: 0,
    pullRequests: 0,
    jiraAutoProgressed: 0,
    jiraAutoDone: 0,
    jiraStatusFailures: 0,
    jiraDoneFailures: 0,
    errors: [],
  };

  let source;
  try {
    source = await db.contributionSource.findUnique({
      where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "lookup failed";
    console.error("[syncGithubProject] source lookup failed:", msg);
    summary.errors.push(`GitHub source lookup: ${msg}`);
    return summary;
  }
  if (!source || !source.enabled) {
    summary.errors.push("No GitHub source configured");
    return summary;
  }

  const config = source.configJson as GithubSourceConfig | null;
  const repos = config?.repos ?? [];
  const accessToken = config?.accessToken ?? config?.token;
  summary.repos = repos.length;
  if (repos.length === 0) {
    summary.errors.push("No repos configured");
    return summary;
  }

  type IdentityWithMember = Prisma.SourceIdentityGetPayload<{
    include: { projectMember: true };
  }>;
  let identities: IdentityWithMember[] = [];
  try {
    identities = await db.sourceIdentity.findMany({
      where: { projectId, sourceType: "GITHUB" },
      include: { projectMember: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "lookup failed";
    console.error("[syncGithubProject] identity lookup failed:", msg);
    summary.errors.push(`Identity lookup: ${msg}`);
  }
  const usernameToUserId = new Map(
    identities.map((i) => [
      i.externalId.toLowerCase(),
      i.projectMember.userId,
    ]),
  );

  const jira = await maybeLoadJiraIssueMap(projectId).catch((err) => {
    summary.errors.push(
      `Jira progress check: ${err instanceof Error ? err.message : "failed"}`,
    );
    return null;
  });

  const lastEventSyncAt =
    source.lastSyncedAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const progressRecheckSince = new Date(Date.now() - JIRA_PROGRESS_RECHECK_MS);
  const since =
    jira && progressRecheckSince < lastEventSyncAt
      ? progressRecheckSince
      : lastEventSyncAt;

  for (const repo of repos) {
    const [owner, name] = repo.split("/");
    if (!owner || !name) continue;

    let commits: GhCommit[] = [];
    try {
      commits = await fetchCommits(owner, name, since, accessToken);
    } catch (err) {
      summary.errors.push(
        err instanceof Error ? err.message : `GitHub commits ${repo}: failed`,
      );
    }

    const existingCommits = await db.contributionEvent.findMany({
      where: {
        sourceId: source.id,
        sourceType: "GITHUB",
        externalId: { in: commits.map((c) => c.sha) },
      },
      select: { externalId: true },
    });
    const existingCommitIds = new Set(existingCommits.map((e) => e.externalId));
    const newCommits = commits.filter((c) => !existingCommitIds.has(c.sha));

    if (commits.length > 0) {
      const result = await db.contributionEvent.createMany({
        data: commits.map((c) => ({
          projectId,
          sourceId: source.id,
          sourceType: "GITHUB" as const,
          externalId: c.sha,
          eventType: "commit",
          payloadJson: {
            repo,
            sha: c.sha,
            message: c.commit.message.split("\n")[0].slice(0, 200),
            login: c.author?.login ?? null,
            url: c.html_url,
          },
          userId: c.author?.login
            ? (usernameToUserId.get(c.author.login.toLowerCase()) ?? null)
            : null,
          weight: 1.0,
          occurredAt: new Date(c.commit.author?.date ?? Date.now()),
        })),
        skipDuplicates: true,
      });
      summary.commits += result.count;

      await addKnowledgeEntries(
        newCommits.map((c) => {
          const subject = c.commit.message.split("\n")[0].slice(0, 200);
          const body = c.commit.message.includes("\n")
            ? c.commit.message.split("\n").slice(1).join("\n").trim()
            : "";
          // Prefer the GitHub-resolved login (renders as @handle).
          // Fall back to the raw git author name so the KB row still
          // has an owner when GitHub couldn't link the commit's email.
          const assignedTo =
            c.author?.login ?? c.commit.author?.name ?? null;
          const authorLabel = c.author?.login ?? "unknown";
          return {
            projectId,
            source: KB_SOURCES.GITHUB,
            sourceRefId: `commit:${repo}:${c.sha}`,
            sourceTypeLabel: "Commit",
            title: subject,
            assignedTo,
            content: [
              `${repo} · ${c.sha.slice(0, 7)} · @${authorLabel}`,
              body,
              c.html_url,
            ]
              .filter(Boolean)
              .join("\n"),
          };
        }),
      );
    }

    const existingProgressEvents = await db.contributionEvent.findMany({
      where: {
        sourceId: source.id,
        sourceType: "GITHUB",
        eventType: {
          in: ["jira_auto_in_progress", "jira_progress_transition_failed"],
        },
        occurredAt: { gte: progressRecheckSince },
      },
      select: { externalId: true },
    });
    const progressCheckedCommitShas = new Set(
      existingProgressEvents
        .map((event) => event.externalId.match(/^jira-progress:([^:]+):/)?.[1])
        .filter((sha): sha is string => Boolean(sha)),
    );
    const commitsForJiraProgressCheck = commits.filter(
      (commit) => !progressCheckedCommitShas.has(commit.sha),
    );

    for (const commit of commitsForJiraProgressCheck) {
      const userId = commit.author?.login
        ? (usernameToUserId.get(commit.author.login.toLowerCase()) ?? null)
        : null;
      let files: GhChangedFile[] = [];
      try {
        files = await fetchCommitFiles(owner, name, commit.sha, accessToken);
      } catch (err) {
        summary.errors.push(
          `Commit code lookup ${repo}@${commit.sha.slice(0, 7)}: ${err instanceof Error ? err.message : "failed"}`,
        );
        continue;
      }
      const jiraProgress = await checkCommitJiraProgress({
        projectId,
        sourceId: source.id,
        repo,
        commit,
        files,
        userId,
        jira,
      });
      if (jiraProgress.actionTaken) summary.jiraAutoProgressed += 1;
      if (jiraProgress.failed) summary.jiraStatusFailures += 1;
      if (jiraProgress.warning) summary.errors.push(jiraProgress.warning);
    }

    let prs: GhPullRequest[] = [];
    try {
      prs = await fetchPullRequests(owner, name, accessToken);
    } catch (err) {
      summary.errors.push(
        err instanceof Error ? err.message : `GitHub PRs ${repo}: failed`,
      );
    }

    if (prs.length > 0) {
      const result = await db.contributionEvent.createMany({
        data: prs.map((pr) => ({
          projectId,
          sourceId: source.id,
          sourceType: "GITHUB" as const,
          externalId: `pr-${repo}-${pr.number}`,
          eventType: pr.merged_at
            ? "pr_merged"
            : pr.state === "closed"
              ? "pr_closed"
              : "pr_opened",
          payloadJson: {
            repo,
            number: pr.number,
            title: pr.title,
            login: pr.user?.login ?? null,
            url: pr.html_url,
            state: pr.state,
            merged_at: pr.merged_at,
          },
          userId: pr.user?.login
            ? (usernameToUserId.get(pr.user.login.toLowerCase()) ?? null)
            : null,
          weight: 3.0,
          occurredAt: new Date(pr.created_at),
        })),
        skipDuplicates: true,
      });
      summary.pullRequests += result.count;

      await addKnowledgeEntries(
        prs.map((pr) => {
          const state = pr.merged_at
            ? "merged"
            : pr.state === "closed"
              ? "closed"
              : "opened";
          const author = pr.user?.login ?? "unknown";
          return {
            projectId,
            source: KB_SOURCES.GITHUB,
            sourceRefId: `pr:${repo}:${pr.number}`,
            sourceTypeLabel: `PR ${state}`,
            title: `#${pr.number} ${pr.title}`,
            assignedTo: pr.user?.login ?? null,
            content: [`${repo} · @${author} · ${state}`, pr.html_url].join(
              "\n",
            ),
          };
        }),
      );
    }

    for (const pr of prs) {
      if (!pr.merged_at) continue;
      const mergedAtMs = Date.parse(pr.merged_at);
      if (Number.isNaN(mergedAtMs)) continue;
      if (Date.now() - mergedAtMs < 6 * 60 * 60 * 1000) continue;

      let files: GhChangedFile[] = [];
      try {
        files = await fetchPullRequestFiles(
          owner,
          name,
          pr.number,
          accessToken,
        );
      } catch (err) {
        summary.errors.push(
          `PR code lookup ${repo}#${pr.number}: ${err instanceof Error ? err.message : "failed"}`,
        );
        continue;
      }

      const userId = pr.user?.login
        ? (usernameToUserId.get(pr.user.login.toLowerCase()) ?? null)
        : null;
      const jiraDone = await checkMergedPrJiraDone({
        projectId,
        sourceId: source.id,
        repo,
        pullRequest: pr,
        files,
        userId,
        jira,
      });
      if (jiraDone.actionTaken) summary.jiraAutoDone += 1;
      if (jiraDone.failed) summary.jiraDoneFailures += 1;
      if (jiraDone.warning) summary.errors.push(jiraDone.warning);
    }
  }

  await db.contributionSource.update({
    where: { id: source.id },
    data: {
      lastSyncedAt: new Date(),
      configJson: {
        ...(config ?? {}),
        repos,
        lastSyncError:
          summary.errors.length > 0
            ? summary.errors.slice(0, 3).join(" | ").slice(0, 1200)
            : null,
        lastSyncOkAt:
          summary.errors.length === 0 ? new Date().toISOString() : null,
      },
    },
  });

  try {
    await recomputeMemberScores(projectId, "github sync");
  } catch (err) {
    summary.errors.push(
      `Score recompute: ${err instanceof Error ? err.message : "failed"}`,
    );
  }

  return summary;
}
