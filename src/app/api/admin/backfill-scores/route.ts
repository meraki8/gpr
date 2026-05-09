import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeMemberScores } from "@/lib/scoring";

// One-time backfill: walks every project that has at least one
// MatchReport (i.e. transcript analyses ran before contributionScore
// was wired up) and re-runs recomputeMemberScores so ProjectMember
// rows get the cumulative score and a ScoreSnapshot is recorded.
// Idempotent — safe to hit more than once. Auth-gated so randoms
// can't trigger it; remove this route once the backfill is done.
export async function GET() {
  await requireDbUser();

  const reports = await db.matchReport.findMany({
    select: { projectId: true },
    distinct: ["projectId"],
  });
  const projectIds = reports.map((r) => r.projectId);

  const results: Array<{
    projectId: string;
    members: number;
    error?: string;
  }> = [];

  for (const projectId of projectIds) {
    try {
      const aggregates = await recomputeMemberScores(projectId, "backfill");
      results.push({ projectId, members: aggregates.length });
    } catch (err) {
      results.push({
        projectId,
        members: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({
    ok: true,
    projectsProcessed: projectIds.length,
    results,
  });
}
