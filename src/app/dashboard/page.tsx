import { UserButton } from "@clerk/nextjs";
import { requireDbUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireDbUser();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-4 bg-[#DC2626]" />
          <span className="font-mono text-sm tracking-widest">GPR</span>
        </div>
        <UserButton />
      </header>
      <section className="flex-1 px-8 py-12">
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Dashboard
        </p>
        <h1 className="text-3xl font-bold mb-2">
          Welcome{user.name ? `, ${user.name}` : ""}.
        </h1>
        <p className="text-white/60">
          Phase 2 will land your groups and projects here.
        </p>
      </section>
    </main>
  );
}
