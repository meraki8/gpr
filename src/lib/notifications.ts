import { db } from "./db";

export const NOTIFICATION_TYPES = {
  INVITE: "invite",
  CARD: "card",
  REPORT: "report",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Bulk-create notifications for a list of users. We createMany with
// skipDuplicates off — each row is unique per (userId, type, time)
// in practice, and we don't want to silently drop legitimate dupes.
export async function notifyUsers(
  rows: Array<{
    userId: string;
    projectId?: string | null;
    type: NotificationType;
    title: string;
    body: string;
    linkUrl?: string | null;
  }>,
) {
  if (rows.length === 0) return;
  await db.notification.createMany({
    data: rows.map((r) => ({
      userId: r.userId,
      projectId: r.projectId ?? null,
      type: r.type,
      title: r.title,
      body: r.body,
      linkUrl: r.linkUrl ?? null,
    })),
  });
}

// Card type → friendly notification copy.
export function cardNotificationBody(
  cardType: "MVP" | "YELLOW" | "RED",
  projectName: string,
  reason: string,
) {
  const word =
    cardType === "MVP"
      ? "an MVP"
      : cardType === "YELLOW"
        ? "a yellow card"
        : "a red card";
  return {
    title: `You received ${word} in ${projectName}`,
    body: reason,
  };
}
