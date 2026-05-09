"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CreateProjectSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  brief: z.string().trim().min(1, "Brief is required"),
  deadline: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
});

export async function createProject(formData: FormData) {
  const user = await requireDbUser();

  const parsed = CreateProjectSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    brief: formData.get("brief"),
    deadline: formData.get("deadline"),
  });
  if (!parsed.success) {
    console.error("[createProject] invalid input:", {
      userId: user.id,
      issues: parsed.error.issues,
    });
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { groupId, name, brief, deadline } = parsed.data;

  // Auth: caller must be a member of the group OR the group's
  // owner OR have access via an existing project membership in
  // this group. The group page already grants visibility on any
  // of those paths, so the create form should accept the same set
  // — otherwise a user who can see the form gets a 500 on submit.
  const [membership, group, projectMembership] = await Promise.all([
    db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    }),
    db.group.findUnique({
      where: { id: groupId },
      select: { id: true, ownerId: true },
    }),
    db.projectMember.findFirst({
      where: {
        userId: user.id,
        project: { groupId, deletedAt: null },
      },
      select: { id: true },
    }),
  ]);

  // Single structured log line for every attempt — lets us match
  // a 500 in Vercel logs to the exact userId/groupId and see which
  // gate (or which DB error) actually rejected it.
  console.log("[createProject] auth check:", {
    userId: user.id,
    userEmail: user.email,
    groupId,
    groupExists: Boolean(group),
    isOwner: group?.ownerId === user.id,
    hasMembership: Boolean(membership),
    hasProjectInGroup: Boolean(projectMembership),
  });

  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }

  const allowed =
    Boolean(membership) ||
    group.ownerId === user.id ||
    Boolean(projectMembership);
  if (!allowed) {
    console.error("[createProject] FORBIDDEN:", {
      userId: user.id,
      groupId,
      ownerId: group.ownerId,
    });
    throw new Error("FORBIDDEN: not a member or owner of this group");
  }

  let project;
  try {
    project = await db.project.create({
      data: {
        groupId,
        name,
        brief,
        deadline,
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });
  } catch (err) {
    const code =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? err.code
        : null;
    console.error("[createProject] db.project.create failed:", {
      userId: user.id,
      groupId,
      name,
      code,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  console.log("[createProject] created:", {
    userId: user.id,
    groupId,
    projectId: project.id,
  });

  revalidatePath(`/groups/${groupId}`);
  redirect(`/projects/${project.id}`);
}
