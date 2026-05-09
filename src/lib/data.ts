import { notFound } from "next/navigation";
import { db } from "./db";
import { requireDbUser } from "./auth";

export async function getMyGroups() {
  const user = await requireDbUser();
  return db.group.findMany({
    where: {
      // Any connection: explicit GroupMember, OR a project the user is a
      // ProjectMember of, OR a project with an accepted email-invite for
      // this user. This way a teammate invited only to a single project
      // still sees that project's group in their sidebar.
      OR: [
        { members: { some: { userId: user.id } } },
        {
          projects: {
            some: {
              deletedAt: null,
              OR: [
                { members: { some: { userId: user.id } } },
                {
                  invites: {
                    some: {
                      email: { equals: user.email, mode: "insensitive" },
                      acceptedAt: { not: null },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    },
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

export async function getMyProjects() {
  const user = await requireDbUser();
  return db.project.findMany({
    where: {
      deletedAt: null,
      // Project membership OR an accepted invite for this email — covers
      // both the canonical case (acceptInvite created a ProjectMember)
      // and any legacy / edge-case state where the invite is accepted
      // without a matching member row.
      OR: [
        { members: { some: { userId: user.id } } },
        {
          invites: {
            some: {
              email: { equals: user.email, mode: "insensitive" },
              acceptedAt: { not: null },
            },
          },
        },
      ],
    },
    include: {
      group: true,
      _count: {
        select: {
          members: true,
          cards: { where: { status: "APPROVED" } },
          matchReports: { where: { status: "PUBLISHED" } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getGroup(groupId: string) {
  const user = await requireDbUser();
  const projectAccessFilter = {
    deletedAt: null,
    OR: [
      { members: { some: { userId: user.id } } },
      {
        invites: {
          some: {
            email: { equals: user.email, mode: "insensitive" as const },
            acceptedAt: { not: null },
          },
        },
      },
    ],
  };
  const group = await db.group.findFirst({
    where: {
      id: groupId,
      // Allow access if user is a GroupMember OR has access to any project
      // in this group. Aligns with sidebar visibility from getMyGroups.
      OR: [
        { members: { some: { userId: user.id } } },
        { projects: { some: projectAccessFilter } },
      ],
    },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
      // Only show projects the user actually has access to — don't leak
      // other projects in the group.
      projects: {
        where: projectAccessFilter,
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
      contributionEvents: {
        orderBy: { occurredAt: "desc" },
        take: 12,
      },
      contributionSources: true,
      invites: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        include: { inviter: true },
      },
    },
  });
  if (!project) notFound();
  return project;
}

export async function getProjectSources(projectId: string) {
  const user = await requireDbUser();

  const member = await db.projectMember.findFirst({
    where: { projectId, userId: user.id },
    select: { role: true },
  });
  if (!member) notFound();

  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      group: true,
      members: {
        include: {
          user: true,
          sourceIdentities: true,
        },
        orderBy: { joinedAt: "asc" },
      },
      contributionSources: { orderBy: { createdAt: "asc" } },
      contributionEvents: {
        orderBy: { occurredAt: "desc" },
        take: 30,
      },
    },
  });
  if (!project) notFound();

  return { project, isOwner: member.role === "OWNER" };
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
