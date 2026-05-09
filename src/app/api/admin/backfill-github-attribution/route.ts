// One-time admin endpoint: re-attributes ContributionEvent rows
// where sourceType=GITHUB and userId IS NULL. Hit once after
// deploying the email/name fallback in sources/actions.ts, then
// delete this file.
//
// For each unattributed event we try, in order:
//   1. payloadJson.login                → username map
//   2. payloadJson.email                → member-email map
//   3. payloadJson.authorName           → member-name map
//   4. live GitHub re-fetch by SHA      → email/name from the git
//      object → member-email / name maps
//
// Step 4 is what actually rescues most of the historical rows: old
// payloads only persisted `login`, and these rows are unattributed
// precisely because login was null. Re-fetching from the GitHub API
// pulls the raw commit author email + name out, which the new
// attribution path uses going forward.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDbUser } from "@/lib/auth";
import { fetchCommits, type GhCommit } from "@/lib/github";
import { recomputeMemberScores } from "@/lib/scoring";

export const maxDuration = 60;

type CommitPayload = {
  repo?: string;
  sha?: string;
  login?: string | null;
  email?: string | null;
  authorName?: string | null;
};

export async function GET() {
  // Auth: signed-in callers only. The endpoint is meant to be
  // self-served by the project owner once and then removed.
  await requireDbUser();

  const events = await db.contributionEvent.findMany({
    where: {
      sourceType: "GITHUB",
      eventType: "commit",
      userId: null,
    },
    select: {
      id: true,
      projectId: true,
      payloadJson: true,
    },
  });

  if (events.length === 0) {
    return NextResponse.json({
      ok: true,
      eventsChecked: 0,
      eventsAttributed: 0,
      projectsRecomputed: 0,
    });
  }

  // Group events by project so we build maps once per project.
  const eventsByProject = new Map<string, typeof events>();
  for (const ev of events) {
    const list = eventsByProject.get(ev.projectId) ?? [];
    list.push(ev);
    eventsByProject.set(ev.projectId, list);
  }

  let eventsAttributed = 0;
  const projectsTouched = new Set<string>();

  for (const [projectId, projectEvents] of eventsByProject) {
    const [identities, members] = await Promise.all([
      db.sourceIdentity.findMany({
        where: { projectId, sourceType: "GITHUB" },
        include: { projectMember: true },
      }),
      db.projectMember.findMany({
        where: { projectId, project: { deletedAt: null } },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    const usernameToUserId = new Map(
      identities.map((i) => [
        i.externalId.toLowerCase(),
        i.projectMember.userId,
      ]),
    );
    const emailToUserId = new Map(
      members.map((m) => [m.user.email.toLowerCase(), m.userId]),
    );
    const nameToUserId = new Map(
      members
        .filter((m) => m.user.name && m.user.name.trim().length > 0)
        .map((m) => [m.user.name!.trim().toLowerCase(), m.userId]),
    );

    // Re-fetch every repo that shows up on this project's
    // unattributed events. fetchCommits returns up to 100 most-recent
    // commits per repo — enough for hackathon-scale rescue. Build
    // sha → { email, name } once.
    const reposNeeded = new Set<string>();
    for (const ev of projectEvents) {
      const repo = (ev.payloadJson as CommitPayload | null)?.repo;
      if (repo) reposNeeded.add(repo);
    }
    const shaInfo = new Map<string, { email: string; name: string }>();
    for (const repo of reposNeeded) {
      const [owner, name] = repo.split("/");
      if (!owner || !name) continue;
      try {
        const commits = await fetchCommits(owner, name);
        for (const c of commits as GhCommit[]) {
          const author = c.commit?.author;
          if (!author) continue;
          shaInfo.set(c.sha, {
            email: author.email ?? "",
            name: author.name ?? "",
          });
        }
      } catch (err) {
        console.error(
          `[backfill] fetchCommits ${repo} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    let projectAttributedCount = 0;

    for (const ev of projectEvents) {
      const payload = (ev.payloadJson ?? {}) as CommitPayload;
      let userId: string | null = null;

      // 1. payloadJson.login
      if (payload.login) {
        userId =
          usernameToUserId.get(payload.login.toLowerCase()) ?? null;
      }
      // 2. payloadJson.email
      if (!userId && payload.email) {
        userId =
          emailToUserId.get(payload.email.toLowerCase()) ?? null;
      }
      // 3. payloadJson.authorName
      if (!userId && payload.authorName) {
        userId =
          nameToUserId.get(payload.authorName.trim().toLowerCase()) ?? null;
      }
      // 4. Live GitHub re-fetch by SHA → email / name maps
      if (!userId && payload.sha) {
        const info = shaInfo.get(payload.sha);
        if (info?.email) {
          userId = emailToUserId.get(info.email.toLowerCase()) ?? null;
        }
        if (!userId && info?.name) {
          userId =
            nameToUserId.get(info.name.trim().toLowerCase()) ?? null;
        }
      }

      if (userId) {
        await db.contributionEvent.update({
          where: { id: ev.id },
          data: { userId },
        });
        eventsAttributed += 1;
        projectAttributedCount += 1;
      }
    }

    if (projectAttributedCount > 0) {
      projectsTouched.add(projectId);
      try {
        await recomputeMemberScores(
          projectId,
          "github attribution backfill",
        );
      } catch (err) {
        console.error(
          `[backfill] recomputeMemberScores ${projectId} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    eventsChecked: events.length,
    eventsAttributed,
    projectsRecomputed: projectsTouched.size,
  });
}
