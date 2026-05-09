"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

const AcceptSchema = z.object({
  token: z.string().min(1),
});

export async function acceptInvite(formData: FormData) {
  const user = await requireDbUser();

  const parsed = AcceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) throw new Error("Invalid input");

  const invite = await db.projectInvite.findUnique({
    where: { token: parsed.data.token },
    include: { project: { select: { deletedAt: true } } },
  });
  if (!invite || invite.project.deletedAt) throw new Error("Invite not found");
  if (invite.expiresAt < new Date() && !invite.acceptedAt) {
    throw new Error("Invite expired");
  }

  // Always ensure the member row exists — claimPendingInvites may have
  // already run (or silently failed), so we check membership directly
  // rather than relying on invite.acceptedAt as a proxy.
  await db.projectMember.upsert({
    where: {
      projectId_userId: { projectId: invite.projectId, userId: user.id },
    },
    create: {
      projectId: invite.projectId,
      userId: user.id,
      role: "MEMBER",
    },
    update: {},
  });

  // Stamp the invite accepted if not already done.
  if (!invite.acceptedAt) {
    await db.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }

  revalidatePath(`/projects/${invite.projectId}`);
  revalidatePath(`/projects/${invite.projectId}/members`);
  redirect(`/projects/${invite.projectId}`);
}
