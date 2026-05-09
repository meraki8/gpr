import type { ProjectRole } from "@prisma/client";
import { db } from "./db";

// Capabilities are free-form strings so the set is extensible without
// migrations. The constants below just give type safety at call sites.

export const CAPABILITIES = {
  // Toggleable per member. Default = enabled for everyone; owner can
  // disable any of these on any non-owner member.
  RUN_ANALYSIS: "run_analysis",
  VIEW_REPORTS: "view_reports",
  VIEW_KB: "view_kb",
  VIEW_LEADERBOARD: "view_leaderboard",
  // Owner-only and never granted to non-owners. Stored capability rows
  // for these are ignored.
  PUBLISH_REPORT: "publish_report",
  APPROVE_CARDS: "approve_cards",
  INVITE_MEMBERS: "invite_members",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_SOURCES: "manage_sources",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const MEMBER_TOGGLEABLE: Capability[] = [
  CAPABILITIES.RUN_ANALYSIS,
  CAPABILITIES.VIEW_REPORTS,
  CAPABILITIES.VIEW_KB,
  CAPABILITIES.VIEW_LEADERBOARD,
];

export const OWNER_ONLY: Capability[] = [
  CAPABILITIES.PUBLISH_REPORT,
  CAPABILITIES.APPROVE_CARDS,
  CAPABILITIES.INVITE_MEMBERS,
  CAPABILITIES.MANAGE_SETTINGS,
  CAPABILITIES.MANAGE_SOURCES,
];

// Human-readable labels for the capability list UI.
export const CAPABILITY_LABELS: Record<string, string> = {
  run_analysis: "Run transcript analysis",
  view_reports: "View match reports",
  view_kb: "View knowledge base",
  view_leaderboard: "View leaderboard",
  publish_report: "Publish match reports",
  approve_cards: "Approve / dismiss cards",
  invite_members: "Invite members",
  manage_settings: "Manage project settings",
  manage_sources: "Manage contribution sources",
};

type StoredCapability = { capability: string; enabled: boolean };

// Resolve whether a given capability is granted, taking role and
// stored toggles into account. Owner gets everything; member-toggleable
// defaults to enabled when no row is stored.
export function resolveCapability(
  role: ProjectRole,
  capability: string,
  storedRows: StoredCapability[],
): boolean {
  if (role === "OWNER") return true;
  if ((OWNER_ONLY as string[]).includes(capability)) return false;
  const row = storedRows.find((r) => r.capability === capability);
  return row?.enabled ?? true;
}

// Resolve every relevant capability for a single member into a map.
export function resolveAllCapabilities(
  role: ProjectRole,
  storedRows: StoredCapability[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const cap of MEMBER_TOGGLEABLE) {
    out[cap] = resolveCapability(role, cap, storedRows);
  }
  for (const cap of OWNER_ONLY) {
    out[cap] = resolveCapability(role, cap, storedRows);
  }
  return out;
}

// Server-side capability check: load the member row and stored
// capabilities, then resolve. Throws if the user isn't a project
// member at all.
export async function requireCapability(
  projectId: string,
  userId: string,
  capability: Capability,
) {
  const member = await db.projectMember.findFirst({
    where: {
      projectId,
      userId,
      project: { deletedAt: null },
    },
    include: {
      capabilities: { select: { capability: true, enabled: true } },
    },
  });
  if (!member) {
    throw new Error("You don't have access to this project");
  }
  const granted = resolveCapability(
    member.role,
    capability,
    member.capabilities,
  );
  if (!granted) {
    throw new Error(
      "You do not have permission to run this on the project.",
    );
  }
  return { member };
}

export async function memberHasCapability(
  projectMemberId: string,
  capability: Capability,
): Promise<boolean> {
  const member = await db.projectMember.findUnique({
    where: { id: projectMemberId },
    include: {
      capabilities: { select: { capability: true, enabled: true } },
    },
  });
  if (!member) return false;
  return resolveCapability(member.role, capability, member.capabilities);
}
