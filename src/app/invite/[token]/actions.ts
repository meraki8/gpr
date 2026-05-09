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
  if (invite.acceptedAt) throw new Error("Invite already used");
  if (invite.expiresAt < new Date()) throw new Error("Invite expired");

  const existing = await db.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: invite.projectId, userId: user.id },
    },
  });

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
  redirect(`/projects/${invite.projectId}`);
}
