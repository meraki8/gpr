"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchCommits, fetchPullRequests } from "@/lib/github";
import { syncJiraProject } from "@/lib/jira-sync";
import { KB_SOURCES, addKnowledgeEntries } from "@/lib/kb";
import { recomputeMemberScores } from "@/lib/scoring";

async function requireOwner(projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId, role: "OWNER" },
  });
  if (!member) throw new Error("FORBIDDEN");
}

const RepoSchema = z.object({
  projectId: z.string().min(1),
  repo: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
      "Use the form 'owner/repo'",
    ),
});

export async function addGithubRepo(formData: FormData) {
  const user = await requireDbUser();
  const parsed = RepoSchema.safeParse({
    projectId: formData.get("projectId"),
    repo: formData.get("repo"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, repo } = parsed.data;
  await requireOwner(projectId, user.id);

  const existing = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });

  const existingRepos: string[] =
    (existing?.configJson as { repos?: string[] } | null)?.repos ?? [];

  if (existingRepos.includes(repo)) {
    throw new Error("That repo is already connected");
  }

  const newConfig = { repos: [...existingRepos, repo] };

  if (existing) {
    await db.contributionSource.update({
      where: { id: existing.id },
      data: { configJson: newConfig },
    });
  } else {
    await db.contributionSource.create({
      data: {
        projectId,
        sourceType: "GITHUB",
        configJson: newConfig,
        enabled: true,
      },
    });
  }

  revalidatePath(`/projects/${projectId}/sources`);
}

const RemoveRepoSchema = z.object({
  projectId: z.string().min(1),
  repo: z.string().min(1),
});

export async function removeGithubRepo(formData: FormData) {
  const user = await requireDbUser();
  const parsed = RemoveRepoSchema.safeParse({
    projectId: formData.get("projectId"),
    repo: formData.get("repo"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId, repo } = parsed.data;
  await requireOwner(projectId, user.id);

  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });
  if (!source) return;

  const existingRepos: string[] =
    (source.configJson as { repos?: string[] } | null)?.repos ?? [];
  const newRepos = existingRepos.filter((r) => r !== repo);

  await db.contributionSource.update({
    where: { id: source.id },
    data: { configJson: { repos: newRepos } },
  });

  revalidatePath(`/projects/${projectId}/sources`);
}

const IdentitySchema = z.object({
  projectId: z.string().min(1),
  projectMemberId: z.string().min(1),
  externalId: z.string().trim().min(1, "GitHub username required"),
});

export async function setGithubUsername(formData: FormData) {
  const user = await requireDbUser();
  const parsed = IdentitySchema.safeParse({
    projectId: formData.get("projectId"),
    projectMemberId: formData.get("projectMemberId"),
    externalId: formData.get("externalId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, projectMemberId, externalId } = parsed.data;
  await requireOwner(projectId, user.id);

  const member = await db.projectMember.findFirst({
    where: { id: projectMemberId, projectId },
  });
  if (!member) throw new Error("FORBIDDEN");

  await db.sourceIdentity.upsert({
    where: {
      projectMemberId_sourceType: {
        projectMemberId,
        sourceType: "GITHUB",
      },
    },
    create: {
      projectId,
      projectMemberId,
      sourceType: "GITHUB",
      externalId,
      verified: false,
    },
    update: { externalId, verified: false },
  });

  revalidatePath(`/projects/${projectId}/sources`);
}

const SyncSchema = z.object({
  projectId: z.string().min(1),
});

export async function syncGithubSource(formData: FormData) {
  const user = await requireDbUser();
  const parsed = SyncSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId } = parsed.data;
  await requireOwner(projectId, user.id);

  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });
  if (!source) throw new Error("No GitHub source configured");

  const config = source.configJson as { repos?: string[] } | null;
  const repos = config?.repos ?? [];
  if (repos.length === 0) throw new Error("No repos configured");

  const identities = await db.sourceIdentity.findMany({
    where: { projectId, sourceType: "GITHUB" },
    include: { projectMember: true },
  });
  const usernameToUserId = new Map(
    identities.map((i) => [
      i.externalId.toLowerCase(),
      i.projectMember.userId,
    ]),
  );

  const since =
    source.lastSyncedAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const repo of repos) {
    const [owner, name] = repo.split("/");

    const commits = await fetchCommits(owner, name, since);
    if (commits.length > 0) {
      await db.contributionEvent.createMany({
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

      await addKnowledgeEntries(
        commits.map((c) => {
          const subject = c.commit.message.split("\n")[0].slice(0, 200);
          const body = c.commit.message.includes("\n")
            ? c.commit.message.split("\n").slice(1).join("\n").trim()
            : "";
          const author = c.author?.login ?? "unknown";
          return {
            projectId,
            source: KB_SOURCES.GITHUB,
            sourceRefId: `commit:${repo}:${c.sha}`,
            sourceTypeLabel: "Commit",
            title: subject,
            content: [
              `${repo} · ${c.sha.slice(0, 7)} · @${author}`,
              body,
              c.html_url,
            ]
              .filter(Boolean)
              .join("\n"),
          };
        }),
      );
    }

    const prs = await fetchPullRequests(owner, name);
    if (prs.length > 0) {
      await db.contributionEvent.createMany({
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
            content: [`${repo} · @${author} · ${state}`, pr.html_url].join(
              "\n",
            ),
          };
        }),
      );
    }
  }

  await db.contributionSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  // GitHub events change every member's bonus, so recompute.
  try {
    await recomputeMemberScores(projectId, "github sync");
  } catch (err) {
    console.error("Failed to recompute member scores:", err);
  }

  revalidatePath(`/projects/${projectId}/sources`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/kb`);
  revalidatePath(`/projects/${projectId}/leaderboard`);
  revalidatePath(`/projects/${projectId}/members`);
}

// =================== JIRA ===================

// Jira base URL must be the workspace root (e.g.
// https://yourorg.atlassian.net). Normalises a few common mistakes
// like trailing slashes or pasting a board URL.
function normaliseJiraBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  // If they pasted a deeper URL, strip back to origin.
  try {
    const parsed = new URL(url);
    url = `${parsed.protocol}//${parsed.host}`;
  } catch {
    throw new Error("Jira URL must look like https://yourorg.atlassian.net");
  }
  return url;
}

const JiraConnectSchema = z.object({
  projectId: z.string().min(1),
  jiraProjectKey: z.string().trim().min(1, "Jira project key required"),
  jiraBaseUrl: z.string().trim().min(1, "Jira base URL required"),
  jiraEmail: z.string().trim().email("Atlassian account email required"),
  jiraApiToken: z.string().trim().min(1, "API token required"),
});

export async function connectJira(formData: FormData) {
  const user = await requireDbUser();
  const parsed = JiraConnectSchema.safeParse({
    projectId: formData.get("projectId"),
    jiraProjectKey: formData.get("jiraProjectKey"),
    jiraBaseUrl: formData.get("jiraBaseUrl"),
    jiraEmail: formData.get("jiraEmail"),
    jiraApiToken: formData.get("jiraApiToken"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const {
    projectId,
    jiraProjectKey,
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
  } = parsed.data;
  await requireOwner(projectId, user.id);

  const baseUrl = normaliseJiraBaseUrl(jiraBaseUrl);

  const existing = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "JIRA" } },
  });

  // Preserve a webhook secret if one was set under the old Make.com flow,
  // so users who already wired Make.com keep working.
  const existingConfig =
    (existing?.configJson as { webhookSecret?: string } | null) ?? {};
  const webhookSecret =
    existingConfig.webhookSecret ?? randomBytes(24).toString("hex");

  const config = {
    projectKey: jiraProjectKey.toUpperCase(),
    baseUrl,
    email: jiraEmail,
    apiToken: jiraApiToken,
    webhookSecret,
  };

  if (existing) {
    await db.contributionSource.update({
      where: { id: existing.id },
      data: { configJson: config, enabled: true },
    });
  } else {
    await db.contributionSource.create({
      data: { projectId, sourceType: "JIRA", configJson: config, enabled: true },
    });
  }

  revalidatePath(`/projects/${projectId}/jira`);
  revalidatePath(`/projects/${projectId}/sources`);
}

const JiraDisconnectSchema = z.object({ projectId: z.string().min(1) });

export async function disconnectJira(formData: FormData) {
  const user = await requireDbUser();
  const parsed = JiraDisconnectSchema.safeParse({ projectId: formData.get("projectId") });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId } = parsed.data;
  await requireOwner(projectId, user.id);

  await db.contributionSource.deleteMany({
    where: { projectId, sourceType: "JIRA" },
  });

  revalidatePath(`/projects/${projectId}/jira`);
  revalidatePath(`/projects/${projectId}/sources`);
}

const JiraIdentitySchema = z.object({
  projectId: z.string().min(1),
  projectMemberId: z.string().min(1),
  externalId: z.string().trim().min(1, "Jira account ID required"),
});

export async function setJiraAccountId(formData: FormData) {
  const user = await requireDbUser();
  const parsed = JiraIdentitySchema.safeParse({
    projectId: formData.get("projectId"),
    projectMemberId: formData.get("projectMemberId"),
    externalId: formData.get("externalId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, projectMemberId, externalId } = parsed.data;
  await requireOwner(projectId, user.id);

  const member = await db.projectMember.findFirst({
    where: { id: projectMemberId, projectId },
  });
  if (!member) throw new Error("FORBIDDEN");

  await db.sourceIdentity.upsert({
    where: { projectMemberId_sourceType: { projectMemberId, sourceType: "JIRA" } },
    create: { projectId, projectMemberId, sourceType: "JIRA", externalId, verified: false },
    update: { externalId, verified: false },
  });

  revalidatePath(`/projects/${projectId}/jira`);
  revalidatePath(`/projects/${projectId}/sources`);
}

const SyncJiraSchema = z.object({ projectId: z.string().min(1) });

export async function syncJiraSource(formData: FormData) {
  const user = await requireDbUser();
  const parsed = SyncJiraSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId } = parsed.data;
  await requireOwner(projectId, user.id);

  const summary = await syncJiraProject(projectId);

  if (summary.errors.length > 0 && summary.scanned === 0) {
    throw new Error(summary.errors[0]);
  }

  revalidatePath(`/projects/${projectId}/jira`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/kb`);
  revalidatePath(`/projects/${projectId}/leaderboard`);
  revalidatePath(`/projects/${projectId}/members`);
}
