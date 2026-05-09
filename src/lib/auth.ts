import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

/**
 * Resolve the Clerk-authenticated user to their User row, creating the row on
 * first sign-in. Also claims any pending email-matching ProjectInvites so the
 * user shows up as a project member even if they didn't click the invite link.
 * Returns null if the request is unauthenticated.
 */
export async function getCurrentDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (existing) {
    // Best-effort: claim any new pending invites that match this user's email
    // (e.g. owner sent invite after the user already signed up).
    await claimPendingInvites(existing.id, existing.email);
    return existing;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const created = await db.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email,
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
      avatarUrl: clerkUser.imageUrl ?? null,
    },
  });

  await claimPendingInvites(created.id, created.email);
  return created;
}

export async function requireDbUser() {
  const user = await getCurrentDbUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * For each unaccepted, unexpired ProjectInvite addressed to this email, create
 * a ProjectMember row (if missing) and mark the invite accepted. Idempotent:
 * a member row that already exists is left alone, the invite is just stamped.
 */
async function claimPendingInvites(userId: string, email: string) {
  try {
    const pending = await db.projectInvite.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        project: { deletedAt: null },
      },
      select: { id: true, projectId: true },
    });
    if (pending.length === 0) return;

    for (const invite of pending) {
      const memberExists = await db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: invite.projectId, userId },
        },
        select: { id: true },
      });

      if (memberExists) {
        await db.projectInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });
      } else {
        await db.$transaction([
          db.projectMember.create({
            data: {
              projectId: invite.projectId,
              userId,
              role: "MEMBER",
            },
          }),
          db.projectInvite.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() },
          }),
        ]);
      }
    }
  } catch (err) {
    // Don't fail the request if invite-claim hits a transient error.
    console.error("[auth] claimPendingInvites failed:", err);
  }
}
