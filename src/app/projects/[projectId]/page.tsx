import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { requireDbUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { analyzeTranscript, inviteMember } from "./actions";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, project] = await Promise.all([
    requireDbUser(),
    getProject(projectId),
  ]);
  const isOwner = project.members.some(
    (m) => m.userId === user.id && m.role === "OWNER",
  );
  const hasGithubSource = project.contributionSources.some(
    (s) => s.sourceType === "GITHUB",
  );

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
          Leaderboard
        </h2>
        <ul className="grid gap-2 mb-12">
          {project.members.map((m, i) => (
            <li
              key={m.id}
              className={`flex items-center gap-4 border px-4 py-3 ${
                i === 0 && m.contributionScore > 0
                  ? "bg-[#DC2626]/5 border-[#DC2626]/40"
                  : "border-white/10"
              }`}
            >
              <div
                className={`font-mono text-2xl font-black w-8 text-center shrink-0 ${
                  i === 0 && m.contributionScore > 0
                    ? "text-[#DC2626]"
                    : "text-white/30"
                }`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {m.user.name ?? m.user.email}
                </div>
                <div className="text-xs font-mono text-white/40 truncate">
                  {m.role.toLowerCase()} · {m.user.email}
                </div>
              </div>
              <div className="font-mono text-3xl font-black text-[#DC2626] tabular-nums shrink-0">
                {m.contributionScore}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/40 mb-12 font-mono -mt-10">
          Scores are the average across all published Match Reports. Publish a
          report to update the leaderboard.
        </p>

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

          {project.invites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">
                Pending invites · {project.invites.length}
              </h3>
              <ul className="grid gap-1">
                {project.invites.map((inv) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil(
                      (inv.expiresAt.getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  return (
                    <li
                      key={inv.id}
                      className="flex items-baseline justify-between gap-3 border border-white/10 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-white/40 font-mono text-xs">
                          Invite sent to{" "}
                        </span>
                        <span className="font-mono truncate">{inv.email}</span>
                      </div>
                      <span className="text-xs font-mono text-white/40 shrink-0">
                        {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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

        {project.cards.length > 0 && (
          <div className="border-t border-white/10 pt-8 mt-12">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-4">
              Recent cards
            </h2>
            <ul className="grid gap-2">
              {project.cards.map((card) => {
                const cardClass =
                  card.cardType === "RED"
                    ? "border-l-[#DC2626]"
                    : card.cardType === "MVP"
                      ? "border-l-white"
                      : "border-l-yellow-400";
                return (
                  <li
                    key={card.id}
                    className={`border border-white/10 border-l-4 ${cardClass} bg-white/5 px-4 py-3`}
                  >
                    <div className="flex items-baseline justify-between mb-1 gap-3 flex-wrap">
                      <div className="font-medium">
                        {card.user.name ?? card.user.email}
                      </div>
                      <div className="text-xs font-mono uppercase tracking-widest text-white/40">
                        {card.cardType} ·{" "}
                        {card.createdAt.toLocaleDateString()}
                      </div>
                    </div>
                    <p className="text-sm text-white/70">{card.reason}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="border-t border-white/10 pt-8 mt-12">
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white/60">
              Sprint progress
            </h2>
            {isOwner && (
              <Link
                href={`/projects/${project.id}/sources`}
                className="font-mono text-xs uppercase tracking-widest text-white/50 hover:text-white"
              >
                Manage sources →
              </Link>
            )}
          </div>
          {project.contributionEvents.length === 0 ? (
            <div className="border border-dashed border-white/20 px-6 py-10 text-center">
              <p className="text-white/60 mb-3">
                {hasGithubSource
                  ? "GitHub source configured. Hit “Sync now” on the sources page to pull commits."
                  : "Connect a GitHub repo to start tracking commits and PRs."}
              </p>
              {isOwner && (
                <Link
                  href={`/projects/${project.id}/sources`}
                  className="inline-block bg-white text-black px-4 py-2 font-medium text-sm"
                >
                  {hasGithubSource ? "Open sources" : "Connect GitHub"}
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid gap-1 font-mono text-sm">
              {project.contributionEvents.map((e) => {
                const payload = e.payloadJson as {
                  login?: string;
                  message?: string;
                  title?: string;
                  url?: string;
                  repo?: string;
                };
                const matchedMember = e.userId
                  ? project.members.find((m) => m.userId === e.userId)
                  : null;
                const displayName = matchedMember
                  ? (matchedMember.user.name ?? matchedMember.user.email)
                  : (payload.login ?? "unknown");
                return (
                  <li
                    key={e.id}
                    className="flex items-baseline gap-3 text-white/70 border-b border-white/5 py-2"
                  >
                    <span className="text-white/30 text-xs w-20 shrink-0">
                      {e.occurredAt.toLocaleDateString()}
                    </span>
                    <span className="text-[#DC2626] uppercase text-xs w-24 shrink-0">
                      {e.eventType}
                    </span>
                    <span className="text-white/60 shrink-0 truncate max-w-[200px]">
                      {displayName}
                    </span>
                    <a
                      href={payload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-white/80 hover:text-white"
                    >
                      {payload.title ?? payload.message ?? "—"}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
