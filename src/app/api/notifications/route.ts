import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Slim listing for the bell dropdown — recent 30 + unread count.
export async function GET() {
  const user = await requireDbUser();
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
    db.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return Response.json({
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      readAt: n.readAt,
      createdAt: n.createdAt,
      project: n.project,
    })),
  });
}
