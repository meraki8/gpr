import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Wordmark } from "@/components/wordmark";

// Sticky public-page header used across /, /changelog, /docs. Solid
// blurred background so content scrolling underneath stays readable.
// Server component so the auth-aware CTA (Sign in vs. Go to Dashboard)
// resolves on the server with no client-side flash.
export async function PublicHeader() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        padding: "16px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          textDecoration: "none",
          color: "var(--ink)",
        }}
      >
        <Wordmark />
      </Link>
      <nav
        style={{
          display: "flex",
          gap: 24,
          fontSize: 14,
          alignItems: "center",
        }}
      >
        <Link href="/#how" className="lk-mute">
          How it works
        </Link>
        <Link href="/changelog" className="lk-mute">
          Changelog
        </Link>
        <Link href="/docs" className="lk-mute">
          Docs
        </Link>
        {isSignedIn ? (
          <Link
            href="/dashboard"
            className="pill pill-red"
            style={{ padding: "9px 16px", fontSize: 14 }}
          >
            Go to Dashboard →
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="pill pill-red"
            style={{ padding: "9px 16px", fontSize: 14 }}
          >
            Sign in →
          </Link>
        )}
      </nav>
    </header>
  );
}
