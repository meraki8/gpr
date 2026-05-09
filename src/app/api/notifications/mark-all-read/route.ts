import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await requireDbUser();
  const { count } = await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true, count });
}
