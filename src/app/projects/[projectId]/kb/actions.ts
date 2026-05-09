"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { KB_SOURCES, addKnowledgeEntry } from "@/lib/kb";

const ManualEntrySchema = z.object({
  projectId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(2, "Title is too short")
    .max(280, "Title is too long"),
  content: z
    .string()
    .trim()
    .min(2, "Content is too short")
    .max(10_000, "Content is too long"),
  label: z.string().trim().max(60).optional(),
});

export async function addManualKnowledgeEntry(formData: FormData) {
  const user = await requireDbUser();

  const parsed = ManualEntrySchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    content: formData.get("content"),
    label: formData.get("label") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, title, content, label } = parsed.data;

  // Manual KB writes are owner-only — same trust boundary as analysis
  // and source config.
  const member = await db.projectMember.findFirst({
    where: { projectId, userId: user.id, role: "OWNER" },
  });
  if (!member) throw new Error("FORBIDDEN");

  await addKnowledgeEntry({
    projectId,
    source: KB_SOURCES.MANUAL,
    title,
    content,
    sourceTypeLabel: label && label.length > 0 ? label : "Note",
  });

  revalidatePath(`/projects/${projectId}/kb`);
}
