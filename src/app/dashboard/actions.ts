"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export async function createGroup(formData: FormData) {
  const user = await requireDbUser();

  const parsed = CreateGroupSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const group = await db.group.create({
    data: {
      name: parsed.data.name,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/groups/${group.id}`);
}
