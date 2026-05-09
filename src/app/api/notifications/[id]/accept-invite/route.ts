import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Accepts a project invite from a notification. Mirrors the logic in
// /invite/[token]/actions.ts so the bell action and the email link
// drop the user into the same place. linkUrl is /invite/<token>.
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
  if (!token) {
    return Response.json(
      { ok: false, error: "Invite link missing" },
      { status: 400 },
    );
  }

  const invite = await db.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { deletedAt: true } } },
  });
  if (!invite || invite.project.deletedAt) {
    return Response.json(
      { ok: false, error: "Invite no longer valid" },
      { status: 410 },
    );
  }
  if (invite.expiresAt < new Date() && !invite.acceptedAt) {
    return Response.json(
      { ok: false, error: "Invite expired" },
      { status: 410 },
    );
  }

  await db.projectMember.upsert({
    where: {
      projectId_userId: { projectId: invite.projectId, userId: user.id },
    },
    create: {
      projectId: invite.projectId,
      userId: user.id,
      role: "MEMBER",
    },
    update: {},
  });
  if (!invite.acceptedAt) {
    await db.projectInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }
  await db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  revalidatePath(`/projects/${invite.projectId}`);
  revalidatePath(`/projects/${invite.projectId}/members`);

  return Response.json({
    ok: true,
    redirectTo: `/projects/${invite.projectId}`,
  });
}

function parseInviteToken(linkUrl: string | null): string | null {
  if (!linkUrl) return null;
  const m = /\/invite\/([^/?#]+)/.exec(linkUrl);
  return m ? m[1] : null;
}
