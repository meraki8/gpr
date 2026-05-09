import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/wordmark";

type Props = {
  // Optional middle nav links rendered between the wordmark and the
  // auth-aware action. Each public page can supply its own (e.g.
  // "Home", "How it works", "Changelog").
  links?: Array<{ href: string; label: string }>;
};

// Server component used on every public page (/, /changelog, etc.)
// so the auth-aware sign-in / dashboard pill stays accurate without
// each page re-implementing the Clerk auth() check.
export async function PublicNav({ links = [] }: Props) {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <header
      className="flex items-center justify-between"
      style={{ padding: "28px 40px", position: "relative", zIndex: 5 }}
    >
      <Wordmark />
      <nav
        style={{
          display: "flex",
          gap: 24,
          fontSize: 14,
          alignItems: "center",
        }}
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="lk-mute">
            {l.label}
          </Link>
        ))}
        {isSignedIn ? (
          <Link
            href="/dashboard"
            className="pill pill-red"
            style={{ padding: "9px 16px", fontSize: 14 }}
          >
            Go to Dashboard →
          </Link>
        ) : (
          <Link href="/sign-in" className="lk-mute">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
