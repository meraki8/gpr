"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";

const InviteSchema = z.object({
  projectId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email address required"),
});

export async function inviteMember(formData: FormData) {
  const user = await requireDbUser();

  const parsed = InviteSchema.safeParse({
    projectId: formData.get("projectId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, email } = parsed.data;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
  });
  if (!project) throw new Error("FORBIDDEN");

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: existingUser.id },
      },
    });
    if (alreadyMember) {
      throw new Error("That email is already a project member");
    }
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.projectInvite.create({
    data: {
      projectId,
      email,
      token,
      invitedBy: user.id,
      expiresAt,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendInviteEmail({
    to: email,
    inviterName: user.name ?? user.email,
    projectName: project.name,
    projectBrief: project.brief,
    inviteUrl: `${appUrl}/invite/${token}`,
  });

  revalidatePath(`/projects/${projectId}`);
}
