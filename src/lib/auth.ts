import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

/**
 * Resolve the Clerk-authenticated user to their User row, creating the row on
 * first sign-in. Returns null if the request is unauthenticated.
 */
export async function getCurrentDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  return db.user.upsert({
    where: { clerkUserId: userId },
    update: {},
    create: {
      clerkUserId: userId,
      email,
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
      avatarUrl: clerkUser.imageUrl ?? null,
    },
  });
}

export async function requireDbUser() {
  const user = await getCurrentDbUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
