import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Declining marks the notification read and expires the underlying
// invite (sets expiresAt to now) so the email link can't accidentally
// pull the user back in. We don't hard-delete in case the inviter
// wants a record that the invite was declined.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const notification = await db.notification.findFirst({
    where: { id, userId: user.id, type: "invite" },
  });
  if (!notification) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const token = parseInviteToken(notification.linkUrl);
  if (token) {
    const invite = await db.projectInvite.findUnique({ where: { token } });
    if (invite && !invite.acceptedAt) {
      await db.projectInvite.update({
        where: { id: invite.id },
        data: { expiresAt: new Date() },
      });
    }
  }

  await db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return Response.json({ ok: true });
}

function parseInviteToken(linkUrl: string | null): string | null {
  if (!linkUrl) return null;
  const m = /\/invite\/([^/?#]+)/.exec(linkUrl);
  return m ? m[1] : null;
}
