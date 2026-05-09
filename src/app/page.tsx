import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default async function HomePage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-4 bg-[#DC2626]" />
          <span className="font-mono text-sm tracking-widest">GPR</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="bg-white text-black px-4 py-2 font-medium"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="text-white/80 hover:text-white">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-white text-black px-4 py-2 font-medium">
                  Get started
                </button>
              </SignUpButton>
            </>
          )}
        </nav>
      </header>

      <section className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-3xl text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-6">
            Group Project Referee
          </p>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Every project
            <br />
            needs a ref.
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-10">
            GPR watches your group projects, keeps receipts, and calls out who
            is delivering and who is not. No confrontation. Just evidence.
          </p>
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-block bg-[#DC2626] text-white px-8 py-3 font-medium hover:bg-[#B91C1C] transition"
            >
              Go to dashboard
            </Link>
          ) : (
            <SignUpButton mode="modal">
              <button className="bg-[#DC2626] text-white px-8 py-3 font-medium hover:bg-[#B91C1C] transition">
                Start a project
              </button>
            </SignUpButton>
          )}
        </div>
      </section>

      <footer className="px-8 py-6 border-t border-white/10 text-xs text-white/40 font-mono">
        GPR · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
