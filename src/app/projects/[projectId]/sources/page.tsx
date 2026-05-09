import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getProjectSources } from "@/lib/data";
import {
  addGithubRepo,
  removeGithubRepo,
  setGithubUsername,
  syncGithubSource,
} from "./actions";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, isOwner } = await getProjectSources(projectId);

  if (!isOwner) notFound();

  const githubSource = project.contributionSources.find(
    (s) => s.sourceType === "GITHUB",
  );
  const githubRepos =
    (githubSource?.configJson as { repos?: string[] } | null)?.repos ?? [];

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <section className="flex-1 px-8 py-12 max-w-5xl mx-auto w-full">
        <Link
          href={`/projects/${projectId}`}
          className="font-mono text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/60 mb-4 inline-block"
        >
          ← {project.name}
        </Link>
        <p className="font-mono text-xs tracking-[0.3em] text-[#DC2626] uppercase mb-2">
          Sources
        </p>
        <h1 className="text-3xl font-bold mb-1">Contribution sources</h1>
        <p className="text-white/60 mb-12">
          Hook up GitHub so commits and PRs feed into the project. Owner only.
        </p>

        <div className="border border-white/10 bg-white/5 px-6 py-6 mb-8">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h2 className="text-xl font-bold">GitHub</h2>
            {githubSource && githubRepos.length > 0 && (
              <form action={syncGithubSource}>
                <input type="hidden" name="projectId" value={projectId} />
                <button
                  type="submit"
                  className="bg-[#DC2626] text-white px-5 py-2 font-medium hover:bg-[#B91C1C] transition"
                >
                  Sync now
                </button>
              </form>
            )}
          </div>
          {githubSource?.lastSyncedAt && (
            <p className="text-xs font-mono text-white/40 mb-6 -mt-4">
              Last synced {githubSource.lastSyncedAt.toLocaleString()}
            </p>
          )}

          <h3 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-3">
            Repos
          </h3>
          {githubRepos.length === 0 ? (
            <p className="text-white/50 italic mb-4">
              No repos connected yet.
            </p>
          ) : (
            <ul className="grid gap-2 mb-4">
              {githubRepos.map((r) => (
                <li
                  key={r}
                  className="flex items-center justify-between border border-white/10 px-4 py-2 font-mono text-sm"
                >
                  <a
                    href={`https://github.com/${r}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    {r}
                  </a>
                  <form action={removeGithubRepo}>
                    <input
                      type="hidden"
                      name="projectId"
                      value={projectId}
                    />
                    <input type="hidden" name="repo" value={r} />
                    <button
                      type="submit"
                      className="text-xs text-white/40 hover:text-[#DC2626]"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={addGithubRepo} className="flex gap-2 max-w-md">
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="text"
              name="repo"
              placeholder="owner/repo"
              required
              className="flex-1 bg-black border border-white/20 px-4 py-2 focus:border-[#DC2626] focus:outline-none font-mono text-sm"
            />
            <button
              type="submit"
              className="bg-white text-black px-5 py-2 font-medium"
            >
              Add repo
            </button>
          </form>

          <h3 className="text-sm font-mono uppercase tracking-widest text-white/60 mt-8 mb-3">
            Member GitHub usernames
          </h3>
          <p className="text-xs text-white/40 mb-4">
            Map each project member to their GitHub username so commits get
            attributed correctly.
          </p>
          <ul className="grid gap-2">
            {project.members.map((m) => {
              const identity = m.sourceIdentities.find(
                (si) => si.sourceType === "GITHUB",
              );
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 border border-white/10 px-4 py-3 flex-wrap"
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-medium text-sm">
                      {m.user.name ?? m.user.email}
                    </div>
                    <div className="text-xs font-mono text-white/40 truncate">
                      {m.user.email}
                    </div>
                  </div>
                  <form
                    action={setGithubUsername}
                    className="flex gap-2 items-center"
                  >
                    <input
                      type="hidden"
                      name="projectId"
                      value={projectId}
                    />
                    <input
                      type="hidden"
                      name="projectMemberId"
                      value={m.id}
                    />
                    <input
                      type="text"
                      name="externalId"
                      placeholder="github-username"
                      defaultValue={identity?.externalId ?? ""}
                      required
                      className="bg-black border border-white/20 px-3 py-1.5 focus:border-[#DC2626] focus:outline-none font-mono text-sm w-44"
                    />
                    <button
                      type="submit"
                      className="bg-white/10 hover:bg-white/20 text-white/80 px-3 py-1.5 text-sm font-medium"
                    >
                      Save
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border border-dashed border-white/10 px-6 py-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-3">
            Recent activity
          </h2>
          {project.contributionEvents.length === 0 ? (
            <p className="text-white/50 italic">
              No contribution events yet. Add a repo and click Sync.
            </p>
          ) : (
            <ul className="grid gap-1 font-mono text-sm">
              {project.contributionEvents.map((e) => {
                const payload = e.payloadJson as {
                  login?: string;
                  message?: string;
                  title?: string;
                  url?: string;
                  repo?: string;
                  number?: number;
                };
                return (
                  <li
                    key={e.id}
                    className="flex items-baseline gap-3 text-white/70"
                  >
                    <span className="text-white/30 text-xs w-20 shrink-0">
                      {e.occurredAt.toLocaleDateString()}
                    </span>
                    <span className="text-[#DC2626] uppercase text-xs w-24 shrink-0">
                      {e.eventType}
                    </span>
                    <span className="text-white/50 shrink-0">
                      @{payload.login ?? "unknown"}
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
