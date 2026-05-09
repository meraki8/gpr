import { notFound } from "next/navigation";
import { db } from "./db";
import { requireDbUser } from "./auth";
import { CAPABILITIES, resolveCapability } from "./capabilities";

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
          cards: true,
          matchReports: true,
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

const EVENTS_PER_PAGE = 10;

export async function getProjectSources(projectId: string, page = 1) {
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
        skip: (page - 1) * EVENTS_PER_PAGE,
        take: EVENTS_PER_PAGE + 1,
      },
    },
  });
  if (!project) notFound();

  const hasNextPage = project.contributionEvents.length > EVENTS_PER_PAGE;
  const contributionEvents = project.contributionEvents.slice(0, EVENTS_PER_PAGE);

  return {
    project: { ...project, contributionEvents },
    isOwner: member.role === "OWNER",
    page,
    hasNextPage,
  };
}

// Resolves the sidebar context from whatever URL the user is on.
// Either groupId or projectId may be passed; the other is derived.
// Returned shape is everything AppShell needs to render its left rail
// in one place — pages call this once and pass the result through.
export async function getNavContext({
  groupId,
  projectId,
}: {
  groupId?: string;
  projectId?: string;
}) {
  const user = await requireDbUser();
  const allGroups = await getMyGroups();

  let activeGroupId = groupId ?? null;
  if (!activeGroupId && projectId) {
    const proj = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { groupId: true },
    });
    activeGroupId = proj?.groupId ?? null;
  }

  if (!activeGroupId) {
    return {
      allGroups,
      activeGroup: null as { id: string; name: string } | null,
      groupProjects: [] as { id: string; name: string }[],
    };
  }

  const activeGroup =
    allGroups.find((g) => g.id === activeGroupId) ?? null;
  if (!activeGroup) {
    return {
      allGroups,
      activeGroup: null as { id: string; name: string } | null,
      groupProjects: [] as { id: string; name: string }[],
    };
  }

  // Projects in the active group, filtered to ones the user can see —
  // mirrors the access rules in getMyGroups so we don't leak siblings.
  const groupProjects = await db.project.findMany({
    where: {
      groupId: activeGroupId,
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
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    allGroups: allGroups.map((g) => ({ id: g.id, name: g.name })),
    activeGroup: { id: activeGroup.id, name: activeGroup.name },
    groupProjects,
  };
}

export async function getProjectMembers(projectId: string) {
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
        include: {
          user: true,
          capabilities: { select: { capability: true, enabled: true } },
        },
        orderBy: [{ contributionScore: "desc" }, { joinedAt: "asc" }],
      },
      invites: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  return project;
}

export async function getProjectTranscripts(projectId: string) {
  const user = await requireDbUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: true,
      transcripts: {
        orderBy: [{ meetingAt: "desc" }, { createdAt: "desc" }],
        include: {
          uploader: true,
          matchReports: { select: { id: true } },
        },
      },
      members: {
        where: { userId: user.id },
        take: 1,
        include: {
          capabilities: { select: { capability: true, enabled: true } },
        },
      },
    },
  });
  if (!project) notFound();

  // For each transcript, count KB entries derived from its report.
  // KB entries from analyzeTranscript have sourceRefId of the form
  // "<reportId>:<idx>", so a startsWith filter scoped to source =
  // "transcript" gives an exact count per report.
  const reportIds = project.transcripts
    .map((t) => t.matchReports[0]?.id)
    .filter((id): id is string => Boolean(id));

  const kbCountsByReport = new Map<string, number>();
  if (reportIds.length > 0) {
    const allEntries = await db.knowledgeEntry.findMany({
      where: {
        projectId,
        source: "transcript",
        OR: reportIds.map((id) => ({ sourceRefId: { startsWith: `${id}:` } })),
      },
      select: { sourceRefId: true },
    });
    for (const entry of allEntries) {
      const refId = entry.sourceRefId ?? "";
      const reportId = refId.split(":")[0];
      kbCountsByReport.set(
        reportId,
        (kbCountsByReport.get(reportId) ?? 0) + 1,
      );
    }
  }

  const transcripts = project.transcripts.map((t) => ({
    ...t,
    kbEntryCount: t.matchReports[0]
      ? (kbCountsByReport.get(t.matchReports[0].id) ?? 0)
      : 0,
  }));

  const viewerMember = project.members[0];
  const isOwner = viewerMember?.role === "OWNER";
  // Resolved here because the page needs to know whether to render
  // the upload form. Owner always has it; member depends on stored
  // capability toggle (default enabled).
  const canRunAnalysis = viewerMember
    ? resolveCapability(
        viewerMember.role,
        CAPABILITIES.RUN_ANALYSIS,
        viewerMember.capabilities,
      )
    : false;
  return {
    project: { ...project, transcripts },
    isOwner,
    canRunAnalysis,
  };
}

export async function getProjectReportsList(projectId: string) {
  const user = await requireDbUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: true,
      members: { where: { userId: user.id }, take: 1 },
      matchReports: {
        // No DB-level status filter — owner needs drafts in the list,
        // non-owner filtering happens below.
        orderBy: { createdAt: "desc" },
        include: {
          transcript: {
            select: { title: true, meetingAt: true },
          },
          _count: { select: { cards: true, memberReports: true } },
        },
      },
    },
  });
  if (!project) notFound();
  const isOwner = project.members[0]?.role === "OWNER";
  // Reports are final the moment the AI returns them — everyone on
  // the project sees every report. isOwner is still surfaced for the
  // role indicator on the page.
  return { project, isOwner, reports: project.matchReports };
}

export async function getProjectKb(projectId: string) {
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
        where: { userId: user.id },
        take: 1,
        include: {
          capabilities: { select: { capability: true, enabled: true } },
        },
      },
    },
  });
  if (!project) notFound();

  // Pull all entries — filtering / grouping / search live in the
  // client component. KB stays small enough that this is fine even
  // for projects that have been running for months.
  const entries = await db.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const viewerMember = project.members[0];
  const isOwner = viewerMember?.role === "OWNER";
  // Manual KB entry is open to owners and any member with the
  // run_analysis capability — same trust level we use for analysis.
  const canAddManual = viewerMember
    ? resolveCapability(
        viewerMember.role,
        CAPABILITIES.RUN_ANALYSIS,
        viewerMember.capabilities,
      )
    : false;
  return { project, entries, isOwner, canAddManual };
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
  // The AI is the ref — every card is final, every report is final.
  // Anyone on the project sees everything.
  return { ...report, isOwner };
}
