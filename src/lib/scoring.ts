import { db } from "./db";

// Per-card adjustments applied on top of the base average.
const CARD_BONUS: Record<string, number> = {
  MVP: 15,
  YELLOW: -5,
  RED: -15,
};

// Per-event GitHub bonuses. ContributionEvent.eventType values written
// by the GitHub sync are "commit" and "pr_opened" / "pr_merged" /
// "pr_closed". All PR variants count the same.
const GITHUB_BONUS: Record<string, number> = {
  commit: 2,
  pr_opened: 5,
  pr_merged: 5,
  pr_closed: 5,
};

const PER_MEETING_CAP = 100;

type MemberAggregate = {
  projectMemberId: string;
  base: number;
  cardAdjustment: number;
  githubBonus: number;
  cardCounts: { MVP: number; YELLOW: number; RED: number };
  githubCounts: { commits: number; prs: number };
  meetingCount: number;
  total: number;
};

// Recomputes ProjectMember.contributionScore for every member of a
// project, plus a ScoreSnapshot row per member, in a single
// transaction. Called after each transcript analysis (new
// MemberReports + cards) and after each GitHub sync (new
// ContributionEvents). The cumulative total is base + card adjustment
// + github bonus and is allowed to grow without cap; per-meeting AI
// scores are clamped to [0, 100] before averaging.
export async function recomputeMemberScores(
  projectId: string,
  reason: string,
): Promise<MemberAggregate[]> {
  const members = await db.projectMember.findMany({
    where: { projectId },
    include: {
      // Reports for THIS project only — analyses happen at the
      // project boundary so no cross-project leakage.
      user: {
        select: {
          memberReports: {
            where: { matchReport: { projectId } },
            select: { contributionScore: true },
          },
        },
      },
    },
  });

  const aggregates: MemberAggregate[] = [];

  for (const m of members) {
    // Base = average of per-meeting contribution scores. AI returns
    // 0-100, but we clamp defensively in case an older row drifted.
    const meetingScores = m.user.memberReports.map((r) =>
      Math.max(0, Math.min(PER_MEETING_CAP, r.contributionScore)),
    );
    const base =
      meetingScores.length === 0
        ? 0
        : Math.round(
            meetingScores.reduce((s, n) => s + n, 0) / meetingScores.length,
          );

    // Cards count (visibility on cards is open since approval gates
    // were removed, but we count every card targeting this user).
    const cardRows = await db.card.findMany({
      where: { projectId, userId: m.userId },
      select: { cardType: true },
    });
    const cardCounts = { MVP: 0, YELLOW: 0, RED: 0 };
    let cardAdjustment = 0;
    for (const c of cardRows) {
      cardCounts[c.cardType] = (cardCounts[c.cardType] ?? 0) + 1;
      cardAdjustment += CARD_BONUS[c.cardType] ?? 0;
    }

    // GitHub events attributed to this user via SourceIdentity →
    // ContributionEvent.userId.
    const eventRows = await db.contributionEvent.findMany({
      where: {
        projectId,
        userId: m.userId,
        sourceType: "GITHUB",
      },
      select: { eventType: true },
    });
    let commits = 0;
    let prs = 0;
    let githubBonus = 0;
    for (const e of eventRows) {
      githubBonus += GITHUB_BONUS[e.eventType] ?? 0;
      if (e.eventType === "commit") commits += 1;
      else if (e.eventType.startsWith("pr_")) prs += 1;
    }

    const total = base + cardAdjustment + githubBonus;

    aggregates.push({
      projectMemberId: m.id,
      base,
      cardAdjustment,
      githubBonus,
      cardCounts,
      githubCounts: { commits, prs },
      meetingCount: meetingScores.length,
      total,
    });
  }

  // Persist atomically: update each ProjectMember and append a
  // ScoreSnapshot in one round-trip.
  await db.$transaction([
    ...aggregates.map((a) =>
      db.projectMember.update({
        where: { id: a.projectMemberId },
        data: { contributionScore: a.total },
      }),
    ),
    ...aggregates.map((a) =>
      db.scoreSnapshot.create({
        data: {
          projectMemberId: a.projectMemberId,
          score: a.total,
          reason: `${reason}: base=${a.base}, cards=${a.cardAdjustment >= 0 ? "+" : ""}${a.cardAdjustment}, github=+${a.githubBonus}`,
        },
      }),
    ),
  ]);

  return aggregates;
}
