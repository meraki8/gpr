import type { getProgressReport } from "./data";

type Report = Awaited<ReturnType<typeof getProgressReport>>;

// Flatten the server-side report into JSON-safe values the client
// PDF generator can consume without dragging Prisma types through
// the boundary.
export function serializeProgressReport(report: Report) {
  return {
    project: {
      id: report.project.id,
      name: report.project.name,
      brief: report.project.brief,
      deadlineIso: report.project.deadline?.toISOString() ?? null,
      groupName: report.project.group.name,
    },
    health: report.health,
    daysToDeadline: report.daysToDeadline,
    githubConnected: report.githubConnected,
    counts: report.counts,
    members: report.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      contributionScore: m.contributionScore,
      cards: m.cards,
      meetingsCount: m.meetingsCount,
      commitsCount: m.commitsCount,
    })),
    meetings: report.meetings.map((m) => ({
      id: m.id,
      iso: (m.meetingAt ?? m.createdAt).toISOString(),
      title: m.title,
      topScorer: m.topScorer,
    })),
    commitments: report.commitments.map((c) => ({
      id: c.id,
      title: c.title,
      assignedTo: c.assignedTo,
      targetDateIso: c.targetDate.toISOString(),
      overdue: c.overdue,
    })),
    decisions: report.decisions.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      createdAtIso: d.createdAt.toISOString(),
    })),
    generatedAtIso: new Date().toISOString(),
  };
}

export type SerializedProgressReport = ReturnType<
  typeof serializeProgressReport
>;
