"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CardActionSchema = z.object({
  cardId: z.string().min(1),
});

const PublishSchema = z.object({
  reportId: z.string().min(1),
});

async function findOwnedCard(cardId: string, userId: string) {
  return db.card.findFirst({
    where: {
      id: cardId,
      project: {
        deletedAt: null,
        members: { some: { userId, role: "OWNER" } },
      },
    },
    select: { id: true, projectId: true, matchReportId: true },
  });
}

export async function approveCard(formData: FormData) {
  const user = await requireDbUser();
  const parsed = CardActionSchema.safeParse({
    cardId: formData.get("cardId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const card = await findOwnedCard(parsed.data.cardId, user.id);
  if (!card) throw new Error("FORBIDDEN");

  await db.card.update({
    where: { id: card.id },
    data: {
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date(),
      // Clear dismiss state if the card was previously dismissed.
      dismissedBy: null,
      dismissedAt: null,
    },
  });

  if (card.matchReportId) {
    revalidatePath(
      `/projects/${card.projectId}/reports/${card.matchReportId}`,
    );
  }
  revalidatePath(`/projects/${card.projectId}`);
}

export async function dismissCard(formData: FormData) {
  const user = await requireDbUser();
  const parsed = CardActionSchema.safeParse({
    cardId: formData.get("cardId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const card = await findOwnedCard(parsed.data.cardId, user.id);
  if (!card) throw new Error("FORBIDDEN");

  await db.card.update({
    where: { id: card.id },
    data: {
      status: "DISMISSED",
      dismissedBy: user.id,
      dismissedAt: new Date(),
      approvedBy: null,
      approvedAt: null,
    },
  });

  if (card.matchReportId) {
    revalidatePath(
      `/projects/${card.projectId}/reports/${card.matchReportId}`,
    );
  }
  revalidatePath(`/projects/${card.projectId}`);
}

export async function publishReport(formData: FormData) {
  const user = await requireDbUser();
  const parsed = PublishSchema.safeParse({
    reportId: formData.get("reportId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const report = await db.matchReport.findFirst({
    where: {
      id: parsed.data.reportId,
      project: {
        deletedAt: null,
        members: { some: { userId: user.id, role: "OWNER" } },
      },
    },
    select: { id: true, projectId: true, status: true },
  });
  if (!report) throw new Error("FORBIDDEN");
  if (report.status === "PUBLISHED") return;

  await db.matchReport.update({
    where: { id: report.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  revalidatePath(`/projects/${report.projectId}/reports/${report.id}`);
  revalidatePath(`/projects/${report.projectId}`);
}
