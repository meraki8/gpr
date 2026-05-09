import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  await db.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
}
