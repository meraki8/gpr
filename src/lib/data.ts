import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { requireDbUser } from "./auth";
import { CAPABILITIES, resolveCapability } from "./capabilities";
import { computeProjectHealth } from "./health";

export async function checkContractGate(projectId: string) {
  const user = await requireDbUser();

  // Owners are never blocked — they may need to generate the contract first.
  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || membership.role === "OWNER") return;

  // For non-owner members: require a signed contract.
  // Redirect if no contract has been generated yet, OR if they haven't signed.
  const contract = await db.contract.findUnique({
    where: { projectId },
    select: {
      id: true,
      signatures: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!contract || contract.signatures.length === 0) {
    redirect(`/projects/${projectId}/contract`);
  }
}

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

// Powers the redesigned project overview / command-centre page.
// Bundles header counts, leaderboard top-3, the latest match report
// with its top scorers, a unified recent-activity timeline, and the
// open-commitment list in a single round-trip.
export async function getProjectOverview(projectId: string) {
  const user = await requireDbUser();

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: { select: { id: true, name: true } },
      members: {
        orderBy: [
          { contributionScore: "desc" },
          { joinedAt: "asc" },
        ],
        include: { user: true },
      },
    },
  });
  if (!project) notFound();

  const isOwner = project.members.some(
    (m) => m.userId === user.id && m.role === "OWNER",
  );

  const ACTIVITY_LOOKBACK = 30;
  const TIMELINE_SIZE = 8;

  const [
    meetingsCount,
    cardsCount,
    kbCount,
    latestReport,
    recentTranscripts,
    recentCards,
    recentKb,
    recentJoins,
    recentEvents,
    recentReports,
    openCommitments,
    allCardsForCounts,
  ] = await Promise.all([
    db.matchReport.count({ where: { projectId } }),
    db.card.count({ where: { projectId } }),
    db.knowledgeEntry.count({ where: { projectId } }),
    db.matchReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        memberReports: {
          orderBy: { contributionScore: "desc" },
          take: 3,
          include: { user: true },
        },
        cards: { include: { user: true } },
      },
    }),
    db.transcript.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LOOKBACK,
      include: { uploader: { select: { name: true, email: true } } },
    }),
    db.card.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LOOKBACK,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.knowledgeEntry.findMany({
      where: { projectId, source: { not: "transcript" } },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LOOKBACK,
    }),
    db.projectMember.findMany({
      where: { projectId },
      orderBy: { joinedAt: "desc" },
      take: ACTIVITY_LOOKBACK,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.contributionEvent.findMany({
      where: { projectId, sourceType: "GITHUB" },
      orderBy: { occurredAt: "desc" },
      take: ACTIVITY_LOOKBACK,
    }),
    db.matchReport.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LOOKBACK,
    }),
    db.knowledgeEntry.findMany({
      where: {
        projectId,
        source: "transcript",
        assignedTo: { not: null },
        targetDate: { not: null },
      },
      orderBy: { targetDate: "asc" },
      take: 12,
    }),
    db.card.findMany({
      where: { projectId },
      select: { userId: true, cardType: true },
    }),
  ]);

  const cardCountsByUser = new Map<
    string,
    { mvp: number; y: number; r: number }
  >();
  for (const c of allCardsForCounts) {
    const bucket = cardCountsByUser.get(c.userId) ?? {
      mvp: 0,
      y: 0,
      r: 0,
    };
    if (c.cardType === "MVP") bucket.mvp += 1;
    else if (c.cardType === "YELLOW") bucket.y += 1;
    else if (c.cardType === "RED") bucket.r += 1;
    cardCountsByUser.set(c.userId, bucket);
  }

  type Activity = {
    key: string;
    at: Date;
    kind:
      | "transcript"
      | "card"
      | "kb"
      | "join"
      | "github"
      | "report";
    actor: string | null;
    title: string;
    detail?: string;
  };

  const activities: Activity[] = [];

  for (const t of recentTranscripts) {
    activities.push({
      key: `t-${t.id}`,
      at: t.createdAt,
      kind: "transcript",
      actor:
        t.uploader.name ?? t.uploader.email.split("@")[0] ?? "someone",
      title: t.title ?? "Transcript uploaded",
    });
  }
  for (const c of recentCards) {
    activities.push({
      key: `c-${c.id}`,
      at: c.createdAt,
      kind: "card",
      actor: c.user.name ?? c.user.email.split("@")[0] ?? "member",
      title: `${c.cardType.toLowerCase()} card issued`,
      detail: c.reason,
    });
  }
  for (const k of recentKb) {
    activities.push({
      key: `k-${k.id}`,
      at: k.createdAt,
      kind: "kb",
      actor: null,
      title: k.title,
      detail: k.sourceTypeLabel ?? k.source,
    });
  }
  for (const m of recentJoins) {
    activities.push({
      key: `j-${m.id}`,
      at: m.joinedAt,
      kind: "join",
      actor: m.user.name ?? m.user.email.split("@")[0],
      title: `joined the project`,
    });
  }
  // Group GitHub commits by day so a sync of 50 commits doesn't drown
  // the feed. PRs stay individual since they're rarer.
  const commitBuckets = new Map<
    string,
    { at: Date; count: number; login: string | null }
  >();
  for (const e of recentEvents) {
    const payload = e.payloadJson as {
      login?: string;
      title?: string;
      url?: string;
    };
    if (e.eventType === "commit") {
      const day = e.occurredAt.toISOString().slice(0, 10);
      const bucket = commitBuckets.get(day) ?? {
        at: e.occurredAt,
        count: 0,
        login: payload.login ?? null,
      };
      bucket.count += 1;
      if (e.occurredAt > bucket.at) bucket.at = e.occurredAt;
      commitBuckets.set(day, bucket);
    } else {
      activities.push({
        key: `g-${e.id}`,
        at: e.occurredAt,
        kind: "github",
        actor: payload.login ?? null,
        title: payload.title ?? e.eventType.replace(/_/g, " "),
      });
    }
  }
  for (const [day, b] of commitBuckets) {
    activities.push({
      key: `gc-${day}`,
      at: b.at,
      kind: "github",
      actor: b.login,
      title: `${b.count} commit${b.count === 1 ? "" : "s"} pushed`,
    });
  }
  for (const r of recentReports) {
    activities.push({
      key: `r-${r.id}`,
      at: r.createdAt,
      kind: "report",
      actor: null,
      title: "Match report published",
    });
  }

  activities.sort((a, b) => b.at.getTime() - a.at.getTime());
  const timeline = activities.slice(0, TIMELINE_SIZE);

  // Resolve open-commitment assignees — assignedTo is a free-form
  // string (usually a name from the transcript), so we best-effort
  // match against project members for an avatar.
  const memberByName = new Map<
    string,
    { id: string; name: string | null; email: string; avatarUrl: string | null }
  >();
  for (const m of project.members) {
    const lc = (m.user.name ?? m.user.email).toLowerCase();
    memberByName.set(lc, {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    });
    // also key by first name token
    const first = lc.split(/[\s@]/)[0];
    if (first && !memberByName.has(first)) {
      memberByName.set(first, {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      });
    }
  }
  const commitments = openCommitments.map((c) => {
    const key = (c.assignedTo ?? "").toLowerCase().trim();
    const matched =
      memberByName.get(key) ??
      memberByName.get(key.split(/\s+/)[0] ?? "") ??
      null;
    return {
      id: c.id,
      title: c.title,
      assignedTo: c.assignedTo,
      assignee: matched,
      targetDate: c.targetDate as Date,
    };
  });

  const health = await computeProjectHealth(projectId);

  // Trend = current health vs the snapshot taken right before the
  // most recent transcript analysis. Snapshots are written *after*
  // analysis, so the most recent snapshot is the score *as of* the
  // latest meeting. To answer "since last meeting" we compare today
  // against the second-most-recent snapshot. If only one snapshot
  // exists we fall back to comparing against it directly so the
  // first analysis still shows a delta from the implicit 100
  // baseline. Wrapped in try/catch so the page still renders if the
  // migration that introduced this table hasn't run yet.
  let previousHealthScore: number | null = null;
  try {
    const recentSnapshots = await db.projectHealthSnapshot.findMany({
      where: { projectId },
      orderBy: { computedAt: "desc" },
      take: 2,
      select: { score: true, computedAt: true },
    });
    previousHealthScore =
      recentSnapshots.length >= 2
        ? recentSnapshots[1].score
        : (recentSnapshots[0]?.score ?? null);
  } catch (err) {
    console.error("[overview] health snapshot lookup failed:", err);
  }
  const healthTrend =
    previousHealthScore !== null ? health.score - previousHealthScore : 0;

  return {
    project,
    isOwner,
    counts: {
      members: project.members.length,
      meetings: meetingsCount,
      cards: cardsCount,
      kb: kbCount,
    },
    healthScore: health.score,
    healthBreakdown: health,
    healthTrend,
    previousHealthScore,
    latestReport,
    timeline,
    commitments,
    cardCountsByUser,
  };
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

export async function getProjectSources(
  projectId: string,
  page = 1,
  eventSourceType?: "GITHUB" | "JIRA",
) {
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
        where: eventSourceType ? { sourceType: eventSourceType } : undefined,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * EVENTS_PER_PAGE,
        take: EVENTS_PER_PAGE + 1,
      },
    },
  });
  if (!project) notFound();

  const hasNextPage = project.contributionEvents.length > EVENTS_PER_PAGE;
  const contributionEvents = project.contributionEvents.slice(0, EVENTS_PER_PAGE);

  // Pull ALL GitHub events with a mapped userId to build the leaderboard —
  // independent of pagination so the leaderboard always shows totals.
  const allGithubEvents = await db.contributionEvent.findMany({
    where: { projectId, sourceType: "GITHUB", userId: { not: null } },
    select: { userId: true, weight: true, eventType: true },
  });

  type MemberStats = { commits: number; prs: number; totalWeight: number };
  const statsByUser = new Map<string, MemberStats>();
  for (const ev of allGithubEvents) {
    if (!ev.userId) continue;
    const existing = statsByUser.get(ev.userId) ?? { commits: 0, prs: 0, totalWeight: 0 };
    const isPr = ev.eventType.startsWith("pr_");
    statsByUser.set(ev.userId, {
      commits: existing.commits + (isPr ? 0 : 1),
      prs: existing.prs + (isPr ? 1 : 0),
      totalWeight: existing.totalWeight + ev.weight,
    });
  }

  const maxWeight = statsByUser.size > 0
    ? Math.max(...[...statsByUser.values()].map((s) => s.totalWeight))
    : 1;

  const githubLeaderboard = project.members
    .map((m) => {
      const identity = m.sourceIdentities.find((si) => si.sourceType === "GITHUB");
      const stats = statsByUser.get(m.user.id);
      return {
        memberId: m.id,
        userId: m.user.id,
        name: m.user.name ?? m.user.email,
        githubLogin: identity?.externalId ?? null,
        commits: stats?.commits ?? 0,
        prs: stats?.prs ?? 0,
        totalWeight: stats?.totalWeight ?? 0,
        score: stats ? Math.round((stats.totalWeight / maxWeight) * 100) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    project: { ...project, contributionEvents },
    isOwner: member.role === "OWNER",
    page,
    hasNextPage,
    githubLeaderboard,
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

export async function getProjectLeaderboard(projectId: string) {
  const user = await requireDbUser();
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: true,
      contributionSources: {
        select: { sourceType: true, lastSyncedAt: true },
      },
      members: {
        orderBy: [
          { contributionScore: "desc" },
          { joinedAt: "asc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              memberReports: {
                where: { matchReport: { projectId } },
                orderBy: { createdAt: "desc" },
                select: { contributionScore: true, createdAt: true },
              },
            },
          },
          scoreSnapshots: {
            orderBy: { computedAt: "desc" },
            take: 30,
            select: { score: true, computedAt: true },
          },
        },
      },
    },
  });
  if (!project) notFound();

  // For each member: counts of cards by type, GitHub events, and the
  // last + previous per-meeting scores for the trend arrow.
  const cardRows = await db.card.findMany({
    where: { projectId },
    select: { userId: true, cardType: true },
  });
  const cardsByUser = new Map<
    string,
    { MVP: number; YELLOW: number; RED: number }
  >();
  for (const c of cardRows) {
    const bucket = cardsByUser.get(c.userId) ?? {
      MVP: 0,
      YELLOW: 0,
      RED: 0,
    };
    bucket[c.cardType] += 1;
    cardsByUser.set(c.userId, bucket);
  }

  const githubEvents = await db.contributionEvent.findMany({
    where: { projectId, sourceType: "GITHUB" },
    select: { userId: true, eventType: true },
  });
  const githubByUser = new Map<
    string,
    { commits: number; prs: number }
  >();
  for (const e of githubEvents) {
    if (!e.userId) continue;
    const bucket = githubByUser.get(e.userId) ?? { commits: 0, prs: 0 };
    if (e.eventType === "commit") bucket.commits += 1;
    else if (e.eventType.startsWith("pr_")) bucket.prs += 1;
    githubByUser.set(e.userId, bucket);
  }

  // Jira aggregation: per-user counts of completed / AC-failed
  // tickets, plus the project's "active sprint" derived from the
  // most recent payloads (Jira webhook + REST sync both write
  // sprintActiveName).
  const jiraEvents = await db.contributionEvent.findMany({
    where: { projectId, sourceType: "JIRA" },
    select: {
      userId: true,
      eventType: true,
      payloadJson: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "desc" },
  });
  type JiraBucket = {
    completed: number;
    acFailed: number;
    overdue: number;
    sprintCompleted: number;
    sprintTotal: number;
  };
  const jiraByUser = new Map<string, JiraBucket>();
  const sprintNameVotes = new Map<string, number>();
  // Most recent payload per issueId — used to compute sprint totals
  // without double-counting an issue that has multiple events.
  type LatestIssue = {
    issueId: string;
    userId: string | null;
    statusCategory: string;
    sprint: string | null;
    isAcFailed: boolean;
    isOverdue: boolean;
  };
  const latestByIssueId = new Map<string, LatestIssue>();
  // Track which (user, issue) pairs we've already credited a
  // completion to so re-syncs don't inflate counts.
  const completedSeen = new Set<string>();
  const acFailedSeen = new Set<string>();
  const overdueSeenToday = new Set<string>();

  for (const e of jiraEvents) {
    const payload = e.payloadJson as {
      issueId?: string;
      statusCategory?: string;
      sprintActiveName?: string | null;
      acAllMet?: boolean;
    };
    if (payload.sprintActiveName) {
      sprintNameVotes.set(
        payload.sprintActiveName,
        (sprintNameVotes.get(payload.sprintActiveName) ?? 0) + 1,
      );
    }

    if (payload.issueId && !latestByIssueId.has(payload.issueId)) {
      latestByIssueId.set(payload.issueId, {
        issueId: payload.issueId,
        userId: e.userId,
        statusCategory: payload.statusCategory ?? "undefined",
        sprint: payload.sprintActiveName ?? null,
        isAcFailed:
          e.eventType === "issue_completed_ac_failed" ||
          payload.acAllMet === false,
        isOverdue: e.eventType === "issue_overdue",
      });
    }

    if (!e.userId || !payload.issueId) continue;
    const bucket = jiraByUser.get(e.userId) ?? {
      completed: 0,
      acFailed: 0,
      overdue: 0,
      sprintCompleted: 0,
      sprintTotal: 0,
    };
    const issueKey = `${e.userId}:${payload.issueId}`;
    if (
      e.eventType === "issue_completed" ||
      e.eventType === "issue_completed_ac_failed"
    ) {
      if (!completedSeen.has(issueKey)) {
        completedSeen.add(issueKey);
        bucket.completed += 1;
      }
    }
    if (
      e.eventType === "issue_completed_ac_failed" &&
      !acFailedSeen.has(issueKey)
    ) {
      acFailedSeen.add(issueKey);
      bucket.acFailed += 1;
    }
    if (e.eventType === "issue_overdue") {
      const dayKey = `${issueKey}:${e.occurredAt.toISOString().slice(0, 10)}`;
      if (!overdueSeenToday.has(dayKey)) {
        overdueSeenToday.add(dayKey);
        bucket.overdue += 1;
      }
    }
    jiraByUser.set(e.userId, bucket);
  }

  // Active sprint = the sprint name we've seen most often in recent
  // payloads. This stays stable across syncs even if a sprint is
  // briefly missing from one issue.
  const activeSprint =
    [...sprintNameVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    null;

  // Per-user sprint progress, computed from the latest snapshot per
  // issue so re-syncs don't double-count.
  let sprintCompletedTotal = 0;
  let sprintTotal = 0;
  if (activeSprint) {
    for (const issue of latestByIssueId.values()) {
      if (issue.sprint !== activeSprint) continue;
      sprintTotal += 1;
      const isDone = issue.statusCategory === "done";
      if (isDone) sprintCompletedTotal += 1;
      if (issue.userId) {
        const bucket = jiraByUser.get(issue.userId) ?? {
          completed: 0,
          acFailed: 0,
          overdue: 0,
          sprintCompleted: 0,
          sprintTotal: 0,
        };
        bucket.sprintTotal += 1;
        if (isDone) bucket.sprintCompleted += 1;
        jiraByUser.set(issue.userId, bucket);
      }
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const enrichedMembers = project.members.map((m, idx) => {
    const reports = m.user.memberReports;
    const lastMeetingScore = reports[0]?.contributionScore ?? null;
    const previousMeetingScore = reports[1]?.contributionScore ?? null;
    const trend =
      lastMeetingScore != null && previousMeetingScore != null
        ? lastMeetingScore - previousMeetingScore
        : 0;

    // Most-improved-this-week: compare current score to the most
    // recent snapshot from before the 7-day window. Snapshots are
    // already sorted desc, so find the last one older than the
    // cutoff.
    const oldSnap = m.scoreSnapshots.find(
      (s) => s.computedAt < sevenDaysAgo,
    );
    const weekDelta = oldSnap ? m.contributionScore - oldSnap.score : 0;

    return {
      id: m.id,
      rank: idx + 1,
      role: m.role,
      contributionScore: m.contributionScore,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      },
      meetingsCount: reports.length,
      lastMeetingScore,
      previousMeetingScore,
      trend,
      weekDelta,
      cardCounts: cardsByUser.get(m.user.id) ?? {
        MVP: 0,
        YELLOW: 0,
        RED: 0,
      },
      github: githubByUser.get(m.user.id) ?? { commits: 0, prs: 0 },
      jira: jiraByUser.get(m.user.id) ?? {
        completed: 0,
        acFailed: 0,
        overdue: 0,
        sprintCompleted: 0,
        sprintTotal: 0,
      },
    };
  });

  // Project-level totals.
  const totalMeetings = await db.matchReport.count({
    where: { projectId },
  });
  const health = await computeProjectHealth(projectId);
  const healthScore = health.score;
  const mostImproved =
    enrichedMembers
      .filter((m) => m.weekDelta > 0)
      .sort((a, b) => b.weekDelta - a.weekDelta)[0] ?? null;
  const hasGithubSource = project.contributionSources.some(
    (s) => s.sourceType === "GITHUB",
  );
  const hasJiraSource = project.contributionSources.some(
    (s) => s.sourceType === "JIRA",
  );

  return {
    project: {
      id: project.id,
      name: project.name,
      group: project.group,
      deadline: project.deadline,
    },
    members: enrichedMembers,
    totals: {
      healthScore,
      totalMeetings,
      mostImproved,
      hasGithubSource,
      hasJiraSource,
      activeSprint,
      sprintCompleted: sprintCompletedTotal,
      sprintTotal,
    },
  };
}

export const KB_PAGE_SIZE = 20;

export type KbDateRangeKey =
  | "today"
  | "7d"
  | "30d"
  | "3m"
  | "all"
  | "custom";

export type KbFilters = {
  page?: number;
  range?: KbDateRangeKey;
  customFrom?: string | null; // YYYY-MM-DD
  customTo?: string | null;
  source?: string | null;
  q?: string | null;
};

// Resolve the active date window from a quick-select key (or a
// custom from/to). Returns null if the range covers everything.
function resolveKbWindow(
  range: KbDateRangeKey,
  customFrom: string | null,
  customTo: string | null,
): { gte?: Date; lt?: Date } | null {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      return { gte: startOfToday };
    case "7d":
      return {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      };
    case "30d":
      return {
        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      };
    case "3m":
      return {
        gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      };
    case "custom": {
      const out: { gte?: Date; lt?: Date } = {};
      if (customFrom) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(customFrom);
        if (m) {
          out.gte = new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3]),
            0,
            0,
            0,
            0,
          );
        }
      }
      if (customTo) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(customTo);
        if (m) {
          // End-of-day inclusive: bump to next day midnight.
          const end = new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3]) + 1,
            0,
            0,
            0,
            0,
          );
          out.lt = end;
        }
      }
      return out.gte || out.lt ? out : null;
    }
    case "all":
    default:
      return null;
  }
}

export async function getProjectKb(
  projectId: string,
  filters: KbFilters = {},
) {
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

  const range: KbDateRangeKey = filters.range ?? "all";
  const customFrom = filters.customFrom ?? null;
  const customTo = filters.customTo ?? null;
  const sourceFilter = filters.source ?? null;
  const q = (filters.q ?? "").trim();
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  const window = resolveKbWindow(range, customFrom, customTo);

  type Where = NonNullable<
    Parameters<typeof db.knowledgeEntry.findMany>[0]
  >["where"];
  const where: Where = { projectId };
  if (window) {
    where.createdAt = {
      ...(window.gte ? { gte: window.gte } : {}),
      ...(window.lt ? { lt: window.lt } : {}),
    };
  }
  if (sourceFilter) {
    where.source = sourceFilter;
  }
  if (q.length > 0) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
      { assignedTo: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalCount, entries, sourceFacets] = await Promise.all([
    db.knowledgeEntry.count({ where }),
    db.knowledgeEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * KB_PAGE_SIZE,
      take: KB_PAGE_SIZE,
    }),
    // Source-filter chip counts respect the current date + search
    // window so the numbers always match what's actually visible.
    (async () => {
      const baseWhere: Where = { projectId };
      if (window) {
        baseWhere.createdAt = {
          ...(window.gte ? { gte: window.gte } : {}),
          ...(window.lt ? { lt: window.lt } : {}),
        };
      }
      if (q.length > 0) {
        baseWhere.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
          { assignedTo: { contains: q, mode: "insensitive" } },
        ];
      }
      const grouped = await db.knowledgeEntry.groupBy({
        by: ["source"],
        where: baseWhere,
        _count: { _all: true },
      });
      const counts: Record<string, number> = {};
      let total = 0;
      for (const g of grouped) {
        counts[g.source] = g._count._all;
        total += g._count._all;
      }
      return { counts, total };
    })(),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / KB_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);

  const viewerMember = project.members[0];
  const isOwner = viewerMember?.role === "OWNER";
  const canAddManual = viewerMember
    ? resolveCapability(
        viewerMember.role,
        CAPABILITIES.RUN_ANALYSIS,
        viewerMember.capabilities,
      )
    : false;
  return {
    project,
    entries,
    totalCount,
    page: safePage,
    totalPages,
    pageSize: KB_PAGE_SIZE,
    sourceCounts: sourceFacets.counts,
    sourceTotal: sourceFacets.total,
    isOwner,
    canAddManual,
    activeFilters: {
      range,
      customFrom,
      customTo,
      source: sourceFilter,
      q,
    },
  };
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

export async function getProjectContract(projectId: string) {
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
          user: { select: { id: true, name: true, email: true } },
        },
      },
      contract: {
        include: {
          signatures: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const viewerMember = project.members.find((m) => m.userId === user.id);
  const isOwner = viewerMember?.role === "OWNER";
  const hasSigned = project.contract
    ? project.contract.signatures.some((s) => s.userId === user.id)
    : false;

  return { project, contract: project.contract, isOwner, hasSigned, user };
}

// Read-only aggregation for the Progress Report page. Pulls the
// existing data the overview page already exposes plus a couple of
// extra slices (per-member commit counts, every meeting, every
// commitment, last 10 transcript decisions). All reads — no writes.
export async function getProgressReport(projectId: string) {
  const user = await requireDbUser();

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    include: {
      group: { select: { id: true, name: true } },
      members: {
        orderBy: [{ contributionScore: "desc" }, { joinedAt: "asc" }],
        include: { user: true },
      },
    },
  });
  if (!project) notFound();

  const [
    health,
    allCards,
    matchReports,
    githubEvents,
    memberReports,
    commitments,
    decisions,
  ] = await Promise.all([
    computeProjectHealth(projectId),
    db.card.findMany({
      where: { projectId },
      select: { userId: true, cardType: true },
    }),
    db.matchReport.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        transcript: { select: { title: true, meetingAt: true } },
        memberReports: {
          orderBy: { contributionScore: "desc" },
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    db.contributionEvent.findMany({
      where: {
        projectId,
        sourceType: "GITHUB",
        eventType: "commit",
      },
      select: { userId: true },
    }),
    db.memberReport.findMany({
      where: { matchReport: { projectId } },
      select: { userId: true },
    }),
    db.knowledgeEntry.findMany({
      where: {
        projectId,
        source: "transcript",
        assignedTo: { not: null },
        targetDate: { not: null },
      },
      orderBy: { targetDate: "asc" },
      select: {
        id: true,
        title: true,
        assignedTo: true,
        targetDate: true,
        sourceTypeLabel: true,
      },
    }),
    db.knowledgeEntry.findMany({
      where: { projectId, source: "transcript" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        assignedTo: true,
      },
    }),
  ]);

  const cardCountsByUser = new Map<
    string,
    { mvp: number; y: number; r: number }
  >();
  for (const c of allCards) {
    const bucket = cardCountsByUser.get(c.userId) ?? { mvp: 0, y: 0, r: 0 };
    if (c.cardType === "MVP") bucket.mvp += 1;
    else if (c.cardType === "YELLOW") bucket.y += 1;
    else if (c.cardType === "RED") bucket.r += 1;
    cardCountsByUser.set(c.userId, bucket);
  }

  const meetingCountsByUser = new Map<string, number>();
  for (const mr of memberReports) {
    meetingCountsByUser.set(
      mr.userId,
      (meetingCountsByUser.get(mr.userId) ?? 0) + 1,
    );
  }

  const commitsByUser = new Map<string, number>();
  for (const ev of githubEvents) {
    if (!ev.userId) continue;
    commitsByUser.set(ev.userId, (commitsByUser.get(ev.userId) ?? 0) + 1);
  }
  const githubConnected = githubEvents.length > 0;

  const memberRows = project.members.map((m) => ({
    id: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    contributionScore: m.contributionScore,
    cards: cardCountsByUser.get(m.userId) ?? { mvp: 0, y: 0, r: 0 },
    meetingsCount: meetingCountsByUser.get(m.userId) ?? 0,
    commitsCount: commitsByUser.get(m.userId) ?? 0,
  }));

  const meetings = matchReports.map((r) => {
    const top = r.memberReports[0];
    return {
      id: r.id,
      createdAt: r.createdAt,
      meetingAt: r.transcript?.meetingAt ?? null,
      title: r.transcript?.title ?? null,
      summary: r.summary,
      topScorer: top
        ? {
            name: top.user.name ?? top.user.email,
            score: top.contributionScore,
          }
        : null,
    };
  });

  const now = Date.now();
  const commitmentRows = commitments.map((c) => ({
    id: c.id,
    title: c.title,
    assignedTo: c.assignedTo,
    targetDate: c.targetDate as Date,
    overdue: (c.targetDate as Date).getTime() < now,
  }));

  const deadlineMs = project.deadline?.getTime() ?? null;
  const daysToDeadline =
    deadlineMs === null
      ? null
      : Math.ceil((deadlineMs - now) / (1000 * 60 * 60 * 24));

  return {
    project,
    health,
    daysToDeadline,
    githubConnected,
    members: memberRows,
    meetings,
    commitments: commitmentRows,
    decisions,
    counts: {
      members: project.members.length,
      meetings: matchReports.length,
      commitments: commitmentRows.length,
      cards: allCards.length,
    },
  };
}
