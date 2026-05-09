import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/wordmark";
import { db } from "@/lib/db";
import { acceptInvite } from "./actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await db.projectInvite.findUnique({
    where: { token },
    include: {
      project: { include: { group: true } },
      inviter: true,
    },
  });

  if (!invite || invite.project.deletedAt) {
    return (
      <ErrorScreen
        title="Invite not found."
        message="This link is invalid or the project was removed."
      />
    );
  }
  if (invite.acceptedAt) {
    // Even if the invite is marked accepted, the current user may not be a
    // project member yet (e.g. auto-claim ran but didn't add them). Add them
    // now if they're signed in and their email matches the invite.
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      const dbUser = await db.user.findFirst({ where: { clerkUserId } });
      if (dbUser && dbUser.email.toLowerCase() === invite.email.toLowerCase()) {
        const alreadyMember = await db.projectMember.findUnique({
          where: { projectId_userId: { projectId: invite.projectId, userId: dbUser.id } },
        });
        if (!alreadyMember) {
          await db.projectMember.create({
            data: { projectId: invite.projectId, userId: dbUser.id, role: "MEMBER" },
          });
        }
      }
    }
    return (
      <ErrorScreen
        title="Already accepted."
        message="This invite has already been used."
        link={`/projects/${invite.projectId}`}
        linkLabel="Open project"
      />
    );
  }
  if (invite.expiresAt < new Date()) {
    return (
      <ErrorScreen
        title="Invite expired."
        message="Ask the project owner to resend it."
      />
    );
  }

  const { userId } = await auth();
  const isSignedIn = !!userId;
  const inviterName = invite.inviter.name ?? invite.inviter.email;

  return (
    <main className="flex flex-1 flex-col">
      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 40px" }}
      >
        <Link href="/">
          <Wordmark />
        </Link>
        <span className="mute-ink" style={{ fontSize: 13 }}>
          Invite
        </span>
      </header>

      <section
        className="wrap"
        style={{
          flex: 1,
          paddingTop: 80,
          paddingBottom: 120,
        }}
      >
        <div className="label fade-up" style={{ marginBottom: 32 }}>
          You&rsquo;ve been invited
        </div>
        <h1
          className="display fade-up"
          style={{
            fontSize: "clamp(56px, 9vw, 124px)",
            margin: 0,
            fontWeight: 500,
            lineHeight: 0.94,
          }}
        >
          {invite.project.name}.
        </h1>
        <div
          className="fade-up"
          style={{ marginTop: 18, animationDelay: "60ms" }}
        >
          <span className="mute-ink" style={{ fontSize: 14 }}>
            in {invite.project.group.name}
          </span>
        </div>

        <p
          className="body-lg fade-up"
          style={{
            maxWidth: 640,
            marginTop: 56,
            animationDelay: "100ms",
          }}
        >
          <strong>{inviterName}</strong> invited you to join this project as
          a member.
        </p>

        <div
          className="fade-up"
          style={{
            marginTop: 32,
            padding: 24,
            borderLeft: "3px solid var(--red)",
            background: "var(--paper)",
            maxWidth: 720,
            whiteSpace: "pre-line",
            color: "var(--ink-2)",
            fontSize: 15,
            lineHeight: 1.55,
            animationDelay: "120ms",
          }}
        >
          {invite.project.brief}
        </div>

        <div
          className="fade-up"
          style={{
            marginTop: 56,
            display: "flex",
            gap: 14,
            alignItems: "center",
            animationDelay: "160ms",
          }}
        >
          {isSignedIn ? (
            <form action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="pill pill-red"
                style={{ padding: "14px 28px", fontSize: 15 }}
              >
                Accept invite →
              </button>
            </form>
          ) : (
            <Link
              href={`/sign-in?redirect_url=/invite/${token}`}
              className="pill pill-red"
              style={{
                padding: "14px 28px",
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Sign in to accept →
            </Link>
          )}
          <span className="mute-ink" style={{ fontSize: 13 }}>
            By accepting you join this project as a member.
          </span>
        </div>
      </section>
    </main>
  );
}

function ErrorScreen({
  title,
  message,
  link,
  linkLabel,
}: {
  title: string;
  message: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <header
        className="flex items-center justify-between"
        style={{ padding: "28px 40px" }}
      >
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <section
        className="wrap"
        style={{
          flex: 1,
          paddingTop: 120,
          paddingBottom: 120,
        }}
      >
        <div className="label" style={{ marginBottom: 24 }}>
          Invite
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(48px, 7vw, 96px)",
            margin: 0,
            fontWeight: 500,
            lineHeight: 0.94,
          }}
        >
          {title}
        </h1>
        <p
          className="body-lg"
          style={{ marginTop: 24, maxWidth: 540 }}
        >
          {message}
        </p>
        <div style={{ marginTop: 32 }}>
          <Link
            href={link ?? "/"}
            className="pill"
            style={{ textDecoration: "none" }}
          >
            {linkLabel ?? "Back to home"}
          </Link>
        </div>
      </section>
    </main>
  );
}
