import { notFound } from "next/navigation";
import { db } from "./db";
import { requireDbUser } from "./auth";

export async function getMyGroups() {
  const user = await requireDbUser();
  return db.group.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      _count: {
        select: {
          members: true,
          projects: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroup(groupId: string) {
  const user = await requireDbUser();
  const group = await db.group.findFirst({
    where: {
      id: groupId,
      members: { some: { userId: user.id } },
    },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!group) notFound();
  return group;
}

export async function getProject(projectId: string) {
  const user = await requireDbUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: true,
      members: {
        include: { user: true },
        // Leaderboard order: highest contribution first, ties broken by
        // earliest joiner (rewards continuity).
        orderBy: [{ contributionScore: "desc" }, { joinedAt: "asc" }],
      },
      matchReports: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          _count: { select: { cards: true, memberReports: true } },
        },
      },
      cards: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: true },
      },
    },
  });
  if (!project) notFound();
  return project;
}

export async function getMatchReport(reportId: string) {
  const user = await requireDbUser();
  const report = await db.matchReport.findFirst({
    where: {
      id: reportId,
      project: {
        deletedAt: null,
        members: { some: { userId: user.id } },
      },
    },
    include: {
      project: {
        include: {
          group: true,
          // Just the current user's membership row, to read role.
          members: { where: { userId: user.id } },
        },
      },
      transcript: true,
      memberReports: {
        include: { user: true },
        orderBy: { contributionScore: "desc" },
      },
      cards: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!report) notFound();

  const isOwner = report.project.members[0]?.role === "OWNER";

  // Draft reports are owner-only.
  if (report.status === "DRAFT" && !isOwner) notFound();

  // Non-owners only see approved cards.
  const visibleCards = isOwner
    ? report.cards
    : report.cards.filter((c) => c.status === "APPROVED");

  return { ...report, cards: visibleCards, isOwner };
}
