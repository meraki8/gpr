import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getGroup } from "@/lib/data";
import { createProject } from "./actions";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const group = await getGroup(groupId);

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/60 mb-4 inline-block"
        >
          ← Dashboard
        </Link>
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Group
        </p>
        <h1 className="text-3xl font-bold mb-1">{group.name}</h1>
        <p className="text-white/60 mb-10">
          {group.members.length} member{group.members.length === 1 ? "" : "s"}{" "}
          · {group.projects.length} active project
          {group.projects.length === 1 ? "" : "s"}
        </p>

        <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
          Projects
        </h2>
        {group.projects.length === 0 ? (
          <p className="text-white/50 mb-12 italic">
            No projects yet. Create one below.
          </p>
        ) : (
          <ul className="grid gap-3 mb-12">
            {group.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-4 transition"
                >
                  <div className="font-medium mb-1">{p.name}</div>
                  <div className="text-xs text-white/50 font-mono">
                    {p.deadline
                      ? `Due ${p.deadline.toLocaleDateString()}`
                      : "No deadline set"}{" "}
                    · health {p.healthScore}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-white/10 pt-8">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
            Create a project
          </h2>
          <form
            action={createProject}
            className="grid gap-3 max-w-2xl"
          >
            <input type="hidden" name="groupId" value={group.id} />
            <input
              type="text"
              name="name"
              placeholder="Project name"
              required
              maxLength={100}
              className="bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none"
            />
            <textarea
              name="brief"
              placeholder="Project brief — what is this project, what does success look like?"
              required
              rows={4}
              className="bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none resize-none"
            />
            <div className="flex gap-2 items-center">
              <label className="text-xs font-mono text-white/50 uppercase tracking-widest">
                Deadline
              </label>
              <input
                type="date"
                name="deadline"
                className="bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-[#DC2626] text-white px-5 py-2 font-medium hover:bg-[#B91C1C] transition justify-self-start"
            >
              Create project
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
