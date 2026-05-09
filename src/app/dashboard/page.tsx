import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/data";
import { createGroup } from "./actions";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const groups = await getMyGroups();

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Dashboard
        </p>
        <h1 className="text-3xl font-bold mb-1">
          Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-white/60 mb-10">
          Your groups and the projects you&apos;re refereeing.
        </p>

        <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
          Your groups
        </h2>
        {groups.length === 0 ? (
          <p className="text-white/50 mb-12 italic">
            No groups yet. Create one below to start.
          </p>
        ) : (
          <ul className="grid gap-3 mb-12">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="block border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-4 transition"
                >
                  <div className="font-medium mb-1">{g.name}</div>
                  <div className="text-xs text-white/50 font-mono">
                    {g._count.members} member
                    {g._count.members === 1 ? "" : "s"} · {g._count.projects}{" "}
                    project{g._count.projects === 1 ? "" : "s"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-white/10 pt-8">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
            Create a group
          </h2>
          <form action={createGroup} className="flex gap-2 max-w-md">
            <input
              type="text"
              name="name"
              placeholder="e.g. Capstone Squad"
              required
              maxLength={100}
              className="flex-1 bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none"
            />
            <button
              type="submit"
              className="bg-[#DC2626] text-white px-5 py-2 font-medium hover:bg-[#B91C1C] transition"
            >
              Create
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
