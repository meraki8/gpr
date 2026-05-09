"use server";

import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendNudgeEmail } from "@/lib/email";

const NudgeSchema = z.object({
  projectId: z.string().min(1),
  recipientUserId: z.string().min(1),
  message: z.string().trim().min(1, "Message is empty").max(2000),
});

export async function nudgeMember(input: {
  projectId: string;
  recipientUserId: string;
  message: string;
}) {
  const user = await requireDbUser();

  const parsed = NudgeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { projectId, recipientUserId, message } = parsed.data;

  if (recipientUserId === user.id) {
    return { ok: false as const, error: "You can't nudge yourself." };
  }

  const callerMembership = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      project: { deletedAt: null },
    },
    select: { id: true, project: { select: { name: true } } },
  });
  if (!callerMembership) {
    return { ok: false as const, error: "Not a member of this project." };
  }

  const recipient = await db.projectMember.findFirst({
    where: { projectId, userId: recipientUserId },
    select: { user: { select: { email: true, name: true } } },
  });
  if (!recipient) {
    return { ok: false as const, error: "That member isn't on this project." };
  }

  try {
    await sendNudgeEmail({
      to: recipient.user.email,
      fromName: user.name ?? user.email,
      projectName: callerMembership.project.name,
      message,
    });
  } catch (err) {
    console.error("[nudge] send failed:", err);
    return { ok: false as const, error: "Failed to send. Try again." };
  }

  return { ok: true as const };
}
