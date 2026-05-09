import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
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
        title="Invite not found"
        message="This invite link is invalid or the project has been removed."
      />
    );
  }
  if (invite.acceptedAt) {
    return (
      <ErrorScreen
        title="Already accepted"
        message="This invite has already been used."
        link={`/projects/${invite.projectId}`}
        linkLabel="Open project"
      />
    );
  }
  if (invite.expiresAt < new Date()) {
    return (
      <ErrorScreen
        title="Invite expired"
        message="This invite has expired. Ask the project owner to send a new one."
      />
    );
  }

  const { userId } = await auth();
  const isSignedIn = !!userId;
  const inviterName = invite.inviter.name ?? invite.inviter.email;

  return (
    <main className="flex flex-1 items-center justify-center px-8 py-20">
      <div className="max-w-xl text-center w-full">
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-4">
          You&rsquo;ve been invited
        </p>
        <h1 className="text-4xl font-bold mb-2">{invite.project.name}</h1>
        <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-6">
          in {invite.project.group.name}
        </p>
        <p className="text-white/70 mb-2">
          <strong>{inviterName}</strong> invited you to join this project as a
          member.
        </p>
        <div className="border border-white/10 bg-white/5 px-5 py-4 my-8 text-left whitespace-pre-line text-white/80 text-sm">
          {invite.project.brief}
        </div>

        {isSignedIn ? (
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="bg-[#DC2626] text-white px-8 py-3 font-medium hover:bg-[#B91C1C] transition"
            >
              Accept invite
            </button>
          </form>
        ) : (
          <Link
            href={`/sign-in?redirect_url=/invite/${token}`}
            className="inline-block bg-[#DC2626] text-white px-8 py-3 font-medium hover:bg-[#B91C1C] transition"
          >
            Sign in to accept
          </Link>
        )}
      </div>
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
    <main className="flex flex-1 items-center justify-center px-8 py-20">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-white/40 uppercase mb-4">
          Invite
        </p>
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-white/60 mb-8">{message}</p>
        {link ? (
          <Link
            href={link}
            className="inline-block bg-white text-black px-6 py-2 font-medium"
          >
            {linkLabel ?? "Continue"}
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-block bg-white text-black px-6 py-2 font-medium"
          >
            Back to home
          </Link>
        )}
      </div>
    </main>
  );
}
