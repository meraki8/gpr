import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncGithubProject } from "@/lib/github-sync";
import { syncJiraProject } from "@/lib/jira-sync";

// Hit by GitHub Actions (or any cron) every N minutes. Loops over
// every project that has an enabled Jira source and runs the same
// sync the in-app "Sync now" button does.
//
// Auth: shared secret via Authorization: Bearer header. Set CRON_SECRET
// in Vercel env and as a GitHub Actions repo secret of the same name.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return run(req);
}

// GET is supported so it can be triggered from a browser during
// debugging — same auth check applies.
export async function GET(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await db.contributionSource.findMany({
    where: { sourceType: "JIRA", enabled: true },
    select: { projectId: true },
  });
  const githubSources = await db.contributionSource.findMany({
    where: { sourceType: "GITHUB", enabled: true },
    select: { projectId: true },
  });

  const summaries = [];
  for (const s of sources) {
    try {
      const summary = await syncJiraProject(s.projectId);
      summaries.push(summary);
    } catch (err) {
      summaries.push({
        projectId: s.projectId,
        scanned: 0,
        errors: [err instanceof Error ? err.message : "unknown error"],
      });
    }
  }

  const githubSummaries = [];
  for (const s of githubSources) {
    try {
      const summary = await syncGithubProject(s.projectId);
      githubSummaries.push(summary);
    } catch (err) {
      githubSummaries.push({
        projectId: s.projectId,
        errors: [err instanceof Error ? err.message : "unknown error"],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    jiraProjects: summaries.length,
    githubProjects: githubSummaries.length,
    summaries,
    githubSummaries,
    ranAt: new Date().toISOString(),
  });
}
