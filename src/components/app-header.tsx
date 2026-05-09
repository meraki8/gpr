import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="h-6 w-4 bg-[#DC2626]" />
        <span className="font-mono text-sm tracking-widest">GPR</span>
      </Link>
      <UserButton />
    </header>
  );
}
