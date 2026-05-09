"use server";

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
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { groupId, name, brief, deadline } = parsed.data;

  // Auth: caller must be a member of the group.
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership) {
    throw new Error("FORBIDDEN");
  }

  const project = await db.project.create({
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

  revalidatePath(`/groups/${groupId}`);
  redirect(`/projects/${project.id}`);
}
