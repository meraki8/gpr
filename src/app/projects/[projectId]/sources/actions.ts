"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchCommits, fetchPullRequests } from "@/lib/github";

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
    }
  }

  await db.contributionSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  revalidatePath(`/projects/${projectId}/sources`);
  revalidatePath(`/projects/${projectId}`);
}
