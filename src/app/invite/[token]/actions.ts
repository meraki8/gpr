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
  });
  if (!invite) throw new Error("Invite not found");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");

  const existing = await db.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: invite.projectId, userId: user.id },
    },
  });

  if (invite.acceptedAt) {
    // claimPendingInvites (called inside requireDbUser) already accepted
    // this invite and created the member row for a new user. Treat it as
    // success and redirect — don't throw "already used".
    if (existing) {
      revalidatePath(`/projects/${invite.projectId}`);
      revalidatePath(`/projects/${invite.projectId}/members`);
      redirect(`/projects/${invite.projectId}`);
    }
    throw new Error("Invite already used");
  }

  if (existing) {
    await db.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  } else {
    await db.$transaction([
      db.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId: user.id,
          role: "MEMBER",
        },
      }),
      db.projectInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
  }

  revalidatePath(`/projects/${invite.projectId}`);
  revalidatePath(`/projects/${invite.projectId}/members`);
  redirect(`/projects/${invite.projectId}`);
}
