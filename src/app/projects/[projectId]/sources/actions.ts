"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncGithubProject } from "@/lib/github-sync";
import { syncJiraProject } from "@/lib/jira-sync";

async function requireOwner(projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId, role: "OWNER" },
  });
  if (!member) throw new Error("FORBIDDEN");
}

type GithubConfig = {
  repos?: string[];
  accessToken?: string;
  token?: string;
  lastSyncError?: string | null;
  lastSyncOkAt?: string | null;
};

// Any member of this project can configure / sync a source. Per
// product philosophy: no unnecessary owner gates. Reserve owner-only
// for destructive actions (removeGithubRepo, disconnectJira).
async function requireMember(projectId: string, userId: string) {
  const member = await db.projectMember.findFirst({
    where: { projectId, userId, project: { deletedAt: null } },
    select: { id: true },
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
  await requireMember(projectId, user.id);

  const existing = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });

  const existingConfig = (existing?.configJson as GithubConfig | null) ?? {};
  const existingRepos = existingConfig.repos ?? [];

  if (existingRepos.length > 0) {
    throw new Error("Only one GitHub repo can be connected to this project");
  }

  if (existingRepos.includes(repo)) {
    throw new Error("That repo is already connected");
  }

  const newConfig = { ...existingConfig, repos: [...existingRepos, repo] };

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

  revalidatePath(`/projects/${projectId}/sources/github`);
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

  const existingConfig = (source.configJson as GithubConfig | null) ?? {};
  const existingRepos = existingConfig.repos ?? [];
  const newRepos = existingRepos.filter((r) => r !== repo);

  await db.contributionSource.update({
    where: { id: source.id },
    data: { configJson: { ...existingConfig, repos: newRepos } },
  });

  revalidatePath(`/projects/${projectId}/sources/github`);
}

const GithubTokenSchema = z.object({
  projectId: z.string().min(1),
  githubAccessToken: z.string().trim().min(1, "GitHub token required"),
});

export async function setGithubAccessToken(formData: FormData) {
  const user = await requireDbUser();
  const parsed = GithubTokenSchema.safeParse({
    projectId: formData.get("projectId"),
    githubAccessToken: formData.get("githubAccessToken"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, githubAccessToken } = parsed.data;
  await requireOwner(projectId, user.id);

  const existing = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });
  const existingConfig = (existing?.configJson as GithubConfig | null) ?? {};
  const newConfig: GithubConfig = {
    ...existingConfig,
    accessToken: githubAccessToken,
  };
  delete newConfig.token;

  if (existing) {
    await db.contributionSource.update({
      where: { id: existing.id },
      data: { configJson: newConfig, enabled: true },
    });
  } else {
    await db.contributionSource.create({
      data: {
        projectId,
        sourceType: "GITHUB",
        configJson: { repos: [], accessToken: githubAccessToken },
        enabled: true,
      },
    });
  }

  revalidatePath(`/projects/${projectId}/sources/github`);
}

const RemoveGithubTokenSchema = z.object({
  projectId: z.string().min(1),
});

export async function removeGithubAccessToken(formData: FormData) {
  const user = await requireDbUser();
  const parsed = RemoveGithubTokenSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId } = parsed.data;
  await requireOwner(projectId, user.id);

  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "GITHUB" } },
  });
  if (!source) return;

  const existingConfig = (source.configJson as GithubConfig | null) ?? {};
  const newConfig: GithubConfig = { ...existingConfig };
  delete newConfig.accessToken;
  delete newConfig.token;

  await db.contributionSource.update({
    where: { id: source.id },
    data: { configJson: newConfig },
  });

  revalidatePath(`/projects/${projectId}/sources/github`);
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
  await requireMember(projectId, user.id);

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

  revalidatePath(`/projects/${projectId}/sources/github`);
}

const SyncSchema = z.object({
  projectId: z.string().min(1),
});

export async function syncGithubSource(formData: FormData) {
  const user = await requireDbUser();
  const parsed = SyncSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    console.error("[syncGithubSource] invalid input:", {
      userId: user.id,
      issues: parsed.error.issues,
    });
    throw new Error("Invalid input");
  }

  const { projectId } = parsed.data;

  try {
    await requireMember(projectId, user.id);

    console.log("[syncGithubSource] start:", {
      userId: user.id,
      projectId,
    });

    const summary = await syncGithubProject(projectId);

    console.log("[syncGithubSource] done:", {
      userId: user.id,
      projectId,
      repos: summary.repos,
      commits: summary.commits,
      pullRequests: summary.pullRequests,
      errorCount: summary.errors.length,
      firstError: summary.errors[0] ?? null,
    });

    if (summary.errors.length > 0 && summary.repos === 0) {
      throw new Error(summary.errors[0]);
    }
  } catch (err) {
    // Surface the failure to the page banner via configJson, then
    // rethrow so the form action visibly fails instead of pretending
    // the sync succeeded.
    const message =
      err instanceof Error ? err.message : "GitHub sync failed";
    console.error("[syncGithubSource] failed:", {
      userId: user.id,
      projectId,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    try {
      const source = await db.contributionSource.findUnique({
        where: {
          projectId_sourceType: { projectId, sourceType: "GITHUB" },
        },
      });
      if (source) {
        const config =
          (source.configJson as GithubConfig | null) ?? {};
        await db.contributionSource.update({
          where: { id: source.id },
          data: {
            configJson: {
              ...config,
              lastSyncError: message.slice(0, 1200),
              lastSyncOkAt: null,
            },
          },
        });
        revalidatePath(`/projects/${projectId}/sources/github`);
      }
    } catch (writeErr) {
      console.error(
        "[syncGithubSource] failed to persist lastSyncError:",
        writeErr instanceof Error ? writeErr.message : writeErr,
      );
    }
    throw err;
  }

  revalidatePath(`/projects/${projectId}/sources/github`);
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
  await requireMember(projectId, user.id);

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

  revalidatePath(`/projects/${projectId}/sources/jira`);
  revalidatePath(`/projects/${projectId}/sources/github`);
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

  revalidatePath(`/projects/${projectId}/sources/jira`);
  revalidatePath(`/projects/${projectId}/sources/github`);
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
  await requireMember(projectId, user.id);

  const member = await db.projectMember.findFirst({
    where: { id: projectMemberId, projectId },
  });
  if (!member) throw new Error("FORBIDDEN");

  await db.sourceIdentity.upsert({
    where: { projectMemberId_sourceType: { projectMemberId, sourceType: "JIRA" } },
    create: { projectId, projectMemberId, sourceType: "JIRA", externalId, verified: false },
    update: { externalId, verified: false },
  });

  revalidatePath(`/projects/${projectId}/sources/jira`);
  revalidatePath(`/projects/${projectId}/sources/github`);
}

const SyncJiraSchema = z.object({ projectId: z.string().min(1) });

export async function syncJiraSource(formData: FormData) {
  const user = await requireDbUser();
  const parsed = SyncJiraSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const { projectId } = parsed.data;
  await requireMember(projectId, user.id);

  const summary = await syncJiraProject(projectId);

  if (summary.errors.length > 0 && summary.scanned === 0) {
    throw new Error(summary.errors[0]);
  }

  revalidatePath(`/projects/${projectId}/sources/jira`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/kb`);
  revalidatePath(`/projects/${projectId}/leaderboard`);
  revalidatePath(`/projects/${projectId}/members`);
}
