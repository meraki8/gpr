import { db } from "./db";

export type HealthBreakdown = {
  score: number;
  base: number;
  deductions: {
    inactiveMembers: number;
    redCardsLast2: number;
    yellowCardsLast2: number;
    overdueCommitments: number;
    projectGoingDark: number;
    ghostMembers: number;
  };
  bonuses: { mvpLastMeeting: number };
  inputs: {
    totalMeetings: number;
    inactiveCount: number;
    ghostCount: number;
    overdueCount: number;
    redCount: number;
    yellowCount: number;
    daysSinceLastTranscript: number | null;
    projectAgeDays: number;
    mvpInLastMeeting: boolean;
  };
};

const BASE = 100;
const PENALTY = {
  INACTIVE_MEMBER: 10,
  RED_CARD: 15,
  YELLOW_CARD: 5,
  OVERDUE_COMMITMENT: 8,
  GOING_DARK: 20,
  GHOST_MEMBER: 5,
} as const;
const BONUS = {
  MVP_LAST_MEETING: 10,
} as const;

const DAY_MS = 1000 * 60 * 60 * 24;
const STALE_TRANSCRIPT_THRESHOLD_DAYS = 7;

// Compute a 0-100 project health score from the live project state.
// Used by both the overview header and the leaderboard top stats so
// they always agree. Pure read — no DB writes.
export async function computeProjectHealth(
  projectId: string,
): Promise<HealthBreakdown> {
  const now = new Date();

  const [
    project,
    members,
    lastTwoReports,
    overdueCount,
    latestTranscript,
    memberReportGroups,
    totalMeetings,
  ] = await Promise.all([
    db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { createdAt: true },
    }),
    db.projectMember.findMany({
      where: { projectId },
      select: { userId: true, contributionScore: true },
    }),
    db.matchReport.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { cards: { select: { cardType: true } } },
    }),
    db.knowledgeEntry.count({
      where: {
        projectId,
        source: "transcript",
        assignedTo: { not: null },
        targetDate: { not: null, lt: now },
      },
    }),
    db.transcript.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.memberReport.groupBy({
      by: ["userId"],
      where: { matchReport: { projectId } },
      _count: { _all: true },
    }),
    db.matchReport.count({ where: { projectId } }),
  ]);

  if (!project) {
    return zeroBreakdown();
  }

  // 1. Inactive members — only counts once we've seen at least two
  // meetings, so brand-new projects don't get docked while data is
  // still building up.
  let inactiveCount = 0;
  if (totalMeetings >= 2) {
    inactiveCount = members.filter((m) => m.contributionScore === 0).length;
  }

  // 2 + 3 + MVP-bonus: scan cards on the last 2 reports. MVP bonus
  // only triggers if the MVP appeared on the most recent meeting.
  let redCount = 0;
  let yellowCount = 0;
  let mvpInLastMeeting = false;
  lastTwoReports.forEach((report, idx) => {
    for (const card of report.cards) {
      if (card.cardType === "RED") redCount += 1;
      else if (card.cardType === "YELLOW") yellowCount += 1;
      else if (card.cardType === "MVP" && idx === 0) {
        mvpInLastMeeting = true;
      }
    }
  });

  // 5. Project going dark — only applies once the project is at
  // least a week old, otherwise we'd punish day-one projects that
  // haven't had a meeting yet.
  const projectAgeDays =
    (now.getTime() - project.createdAt.getTime()) / DAY_MS;
  const daysSinceLastTranscript = latestTranscript
    ? (now.getTime() - latestTranscript.createdAt.getTime()) / DAY_MS
    : null;
  const goingDark =
    projectAgeDays >= STALE_TRANSCRIPT_THRESHOLD_DAYS &&
    (daysSinceLastTranscript === null ||
      daysSinceLastTranscript >= STALE_TRANSCRIPT_THRESHOLD_DAYS);

  // 6. Ghost members — anyone in the project who has never appeared
  // in a MemberReport for any meeting.
  const usersWithReports = new Set(memberReportGroups.map((g) => g.userId));
  const ghostCount = members.filter(
    (m) => !usersWithReports.has(m.userId),
  ).length;

  const deductions = {
    inactiveMembers: inactiveCount * PENALTY.INACTIVE_MEMBER,
    redCardsLast2: redCount * PENALTY.RED_CARD,
    yellowCardsLast2: yellowCount * PENALTY.YELLOW_CARD,
    overdueCommitments: overdueCount * PENALTY.OVERDUE_COMMITMENT,
    projectGoingDark: goingDark ? PENALTY.GOING_DARK : 0,
    ghostMembers: ghostCount * PENALTY.GHOST_MEMBER,
  };
  const bonuses = {
    mvpLastMeeting: mvpInLastMeeting ? BONUS.MVP_LAST_MEETING : 0,
  };

  const totalDeduction =
    deductions.inactiveMembers +
    deductions.redCardsLast2 +
    deductions.yellowCardsLast2 +
    deductions.overdueCommitments +
    deductions.projectGoingDark +
    deductions.ghostMembers;
  const totalBonus = bonuses.mvpLastMeeting;

  const raw = BASE - totalDeduction + totalBonus;
  const score = Math.max(0, Math.min(100, raw));

  return {
    score,
    base: BASE,
    deductions,
    bonuses,
    inputs: {
      totalMeetings,
      inactiveCount,
      ghostCount,
      overdueCount,
      redCount,
      yellowCount,
      daysSinceLastTranscript,
      projectAgeDays,
      mvpInLastMeeting,
    },
  };
}

function zeroBreakdown(): HealthBreakdown {
  return {
    score: 0,
    base: BASE,
    deductions: {
      inactiveMembers: 0,
      redCardsLast2: 0,
      yellowCardsLast2: 0,
      overdueCommitments: 0,
      projectGoingDark: 0,
      ghostMembers: 0,
    },
    bonuses: { mvpLastMeeting: 0 },
    inputs: {
      totalMeetings: 0,
      inactiveCount: 0,
      ghostCount: 0,
      overdueCount: 0,
      redCount: 0,
      yellowCount: 0,
      daysSinceLastTranscript: null,
      projectAgeDays: 0,
      mvpInLastMeeting: false,
    },
  };
}
