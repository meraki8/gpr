import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getProject } from "@/lib/data";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  const daysUntilDeadline = project.deadline
    ? Math.ceil(
        (project.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        <Link
          href={`/groups/${project.group.id}`}
          className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/60 mb-4 inline-block"
        >
          ← {project.group.name}
        </Link>
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Project
        </p>
        <h1 className="text-4xl font-bold mb-3">{project.name}</h1>
        <p className="text-white/70 mb-8 max-w-3xl whitespace-pre-line">
          {project.brief}
        </p>

        <div className="grid gap-6 md:grid-cols-3 mb-12">
          <div className="border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">
              Deadline
            </div>
            <div className="font-medium">
              {project.deadline
                ? project.deadline.toLocaleDateString()
                : "Not set"}
            </div>
            {daysUntilDeadline !== null && (
              <div
                className={`text-xs font-mono mt-1 ${
                  daysUntilDeadline < 0
                    ? "text-[#DC2626]"
                    : daysUntilDeadline < 7
                    ? "text-yellow-400"
                    : "text-white/50"
                }`}
              >
                {daysUntilDeadline < 0
                  ? `${Math.abs(daysUntilDeadline)} day${Math.abs(daysUntilDeadline) === 1 ? "" : "s"} overdue`
                  : daysUntilDeadline === 0
                  ? "Due today"
                  : `${daysUntilDeadline} day${daysUntilDeadline === 1 ? "" : "s"} left`}
              </div>
            )}
          </div>
          <div className="border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">
              Health
            </div>
            <div className="font-medium">{project.healthScore}/100</div>
          </div>
          <div className="border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1">
              Members
            </div>
            <div className="font-medium">{project.members.length}</div>
          </div>
        </div>

        <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
          Members
        </h2>
        <ul className="grid gap-2 mb-12">
          {project.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between border border-white/10 px-4 py-3"
            >
              <div>
                <div className="font-medium">
                  {m.user.name ?? m.user.email}
                </div>
                <div className="text-xs font-mono text-white/40">
                  {m.user.email}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-widest text-white/50">
                  {m.role}
                </span>
                <span className="font-mono text-sm">
                  {m.contributionScore}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-white/10 pt-8 grid gap-4">
          <div className="border border-dashed border-white/20 px-6 py-12 text-center">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 mb-2">
              Phase 4
            </p>
            <p className="text-white/60">
              Transcript upload &amp; AI analysis lands here.
            </p>
          </div>
          <div className="border border-dashed border-white/20 px-6 py-12 text-center">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 mb-2">
              Phase 5
            </p>
            <p className="text-white/60">
              Match Reports &amp; cards land here.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
