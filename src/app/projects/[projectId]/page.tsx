import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { getProject } from "@/lib/data";
import { analyzeTranscript, inviteMember } from "./actions";

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

        <div className="border-t border-white/10 pt-8 mb-12">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
            Invite a member
          </h2>
          <form action={inviteMember} className="flex gap-2 max-w-md">
            <input type="hidden" name="projectId" value={project.id} />
            <input
              type="email"
              name="email"
              placeholder="teammate@example.com"
              required
              className="flex-1 bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none"
            />
            <button
              type="submit"
              className="bg-[#DC2626] text-white px-5 py-2 font-medium hover:bg-[#B91C1C] transition"
            >
              Send invite
            </button>
          </form>
          <p className="text-xs text-white/40 mt-2 font-mono">
            Recipient gets an email with a 7-day accept link.
          </p>
        </div>

        <div className="border-t border-white/10 pt-8 mb-12">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
            Analyze a meeting transcript
          </h2>
          <form action={analyzeTranscript} className="grid gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <textarea
              name="rawText"
              placeholder="Paste the meeting transcript here. Speaker labels help (e.g. 'Alice: I'll have the wireframes by Friday'). The longer and more detailed, the better the analysis."
              required
              rows={8}
              minLength={20}
              className="bg-black border border-white/20 px-4 py-3 focus:border-[#DC2626] focus:outline-none resize-none font-mono text-sm leading-relaxed"
            />
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="bg-[#DC2626] text-white px-6 py-2 font-medium hover:bg-[#B91C1C] transition"
              >
                Run analysis
              </button>
              <p className="text-xs text-white/40 font-mono">
                Takes ~10&ndash;30 seconds. Generates a draft Match Report.
              </p>
            </div>
          </form>
        </div>

        <div className="border-t border-white/10 pt-8">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
            Match Reports
          </h2>
          {project.matchReports.length === 0 ? (
            <p className="text-white/50 italic">
              No reports yet. Paste a transcript above to generate the first
              one.
            </p>
          ) : (
            <ul className="grid gap-3">
              {project.matchReports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/projects/${project.id}/reports/${r.id}`}
                    className="block border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-4 transition"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="font-medium">
                        {r.createdAt.toLocaleString()}
                      </div>
                      <div className="text-xs font-mono uppercase tracking-widest text-white/40">
                        {r.status}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-white/50">
                      {r._count.memberReports} member report
                      {r._count.memberReports === 1 ? "" : "s"} ·{" "}
                      {r._count.cards} card
                      {r._count.cards === 1 ? "" : "s"}
                    </div>
                    <p className="text-sm text-white/70 mt-2 line-clamp-2">
                      {r.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
