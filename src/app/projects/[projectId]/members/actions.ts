"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_TOGGLEABLE, type Capability } from "@/lib/capabilities";

const ToggleSchema = z.object({
  projectId: z.string().min(1),
  projectMemberId: z.string().min(1),
  capability: z.string().min(1),
  enabled: z.enum(["true", "false"]),
});

export async function toggleMemberCapability(formData: FormData) {
  const user = await requireDbUser();

  const parsed = ToggleSchema.safeParse({
    projectId: formData.get("projectId"),
    projectMemberId: formData.get("projectMemberId"),
    capability: formData.get("capability"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, projectMemberId, capability, enabled } = parsed.data;

  // Auth: caller must be project OWNER.
  const callerMembership = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      role: "OWNER",
      project: { deletedAt: null },
    },
    select: { id: true },
  });
  if (!callerMembership) {
    throw new Error("Only the project owner can change capabilities");
  }

  // Capability must be member-toggleable. Owner-only capabilities are
  // never stored or toggled — they're determined by role alone.
  if (!(MEMBER_TOGGLEABLE as string[]).includes(capability)) {
    throw new Error("That capability isn't toggleable");
  }

  // Target must be a member of this project, and not the owner.
  // (Owner capabilities are immutable — owner always has everything.)
  const target = await db.projectMember.findFirst({
    where: { id: projectMemberId, projectId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("Member not found");
  if (target.role === "OWNER") {
    throw new Error("Owner capabilities cannot be changed");
  }

  const enabledBool = enabled === "true";
  await db.memberCapability.upsert({
    where: {
      projectMemberId_capability: {
        projectMemberId,
        capability,
      },
    },
    create: {
      projectMemberId,
      capability: capability as Capability,
      enabled: enabledBool,
    },
    update: { enabled: enabledBool },
  });

  revalidatePath(`/projects/${projectId}/members`);
  revalidatePath(`/projects/${projectId}/transcripts`);
}
