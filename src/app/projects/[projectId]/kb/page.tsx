import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups, getProjectKb } from "@/lib/data";
import { KB_SOURCES } from "@/lib/kb";
import { addManualKnowledgeEntry } from "./actions";

const SOURCE_FILTERS: Array<{ key: string | null; label: string }> = [
  { key: null, label: "All" },
  { key: KB_SOURCES.TRANSCRIPT, label: "Transcript" },
  { key: KB_SOURCES.GITHUB, label: "GitHub" },
  { key: KB_SOURCES.JIRA, label: "Jira" },
  { key: KB_SOURCES.MANUAL, label: "Manual" },
];

const SOURCE_BADGE_COLOR: Record<string, string> = {
  transcript: "var(--red)",
  github: "var(--ink)",
  jira: "var(--ink)",
  manual: "var(--mute)",
};

export default async function KnowledgeBasePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { projectId } = await params;
  const { source: rawSource } = await searchParams;
  const validSources = new Set<string>(Object.values(KB_SOURCES));
  const activeSource =
    rawSource && validSources.has(rawSource) ? rawSource : null;

  const [user, allGroups, { project, entries, counts, isOwner }] =
    await Promise.all([
      requireDbUser(),
      getMyGroups(),
      getProjectKb(projectId, activeSource ?? undefined),
    ]);

  const countMap = new Map(counts.map((c) => [c.source, c._count._all]));
  const totalCount = counts.reduce((sum, c) => sum + c._count._all, 0);

  return (
    <AppShell
      user={user}
      groups={allGroups}
      currentProject={{
        id: project.id,
        name: project.name,
        group: { id: project.group.id, name: project.group.name },
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Knowledge base · ${project.name}`}
          title="What the project knows."
          sub={
            totalCount === 0
              ? "Nothing yet. Run a transcript analysis, sync GitHub, or add a note below."
              : `${totalCount} entr${totalCount === 1 ? "y" : "ies"} across ${counts.length} source${counts.length === 1 ? "" : "s"}. Newest first.`
          }
        />

        {isOwner && (
          <section style={{ paddingBottom: 80, maxWidth: 720 }}>
            <div className="label" style={{ marginBottom: 24 }}>
              Add a note
            </div>
            <form
              action={addManualKnowledgeEntry}
              style={{ display: "grid", gap: 12 }}
            >
              <input type="hidden" name="projectId" value={project.id} />
              <input
                type="text"
                name="title"
                placeholder="Title — what's this about?"
                required
                maxLength={280}
                className="field"
              />
              <textarea
                name="content"
                placeholder="Decision, scope change, side context, link to a doc — anything future-you would want the AI to remember."
                required
                rows={4}
                className="field field-lg"
              />
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="text"
                  name="label"
                  placeholder="Label (optional) — e.g. Decision, Risk"
                  maxLength={60}
                  className="field"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="pill pill-sm">
                  Save →
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Filter chips */}
        <section style={{ paddingBottom: 32 }}>
          <div className="label" style={{ marginBottom: 16 }}>
            Filter by source
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SOURCE_FILTERS.map((f) => {
              const active = activeSource === f.key;
              const count = f.key
                ? (countMap.get(f.key) ?? 0)
                : totalCount;
              const href = f.key
                ? `/projects/${project.id}/kb?source=${f.key}`
                : `/projects/${project.id}/kb`;
              return (
                <Link
                  key={f.label}
                  href={href}
                  className={active ? "pill pill-sm" : "pill pill-ghost pill-sm"}
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{f.label}</span>
                  <span
                    className="num"
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        <section>
          {entries.length === 0 ? (
            <p
              className="body mute-ink"
              style={{ margin: 0, paddingTop: 24 }}
            >
              {activeSource
                ? `No ${activeSource} entries yet.`
                : "No knowledge entries yet."}
            </p>
          ) : (
            entries.map((e, i) => (
              <article
                key={e.id}
                className="fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 32,
                  padding: "28px 0",
                  borderBottom: "1px solid var(--line)",
                  animationDelay: `${Math.min(i, 12) * 30}ms`,
                }}
              >
                <div>
                  <SourceBadge
                    source={e.source}
                    label={e.sourceTypeLabel}
                  />
                  <div
                    className="mute-ink num"
                    style={{ fontSize: 12, marginTop: 8 }}
                  >
                    {e.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="h-s" style={{ marginBottom: 6 }}>
                    {e.title}
                  </div>
                  <div
                    className="body"
                    style={{
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "var(--ink-2)",
                    }}
                  >
                    {e.content}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </AppShell>
  );
}

function SourceBadge({
  source,
  label,
}: {
  source: string;
  label: string | null;
}) {
  const color = SOURCE_BADGE_COLOR[source] ?? "var(--ink)";
  const text = label ? `${source} · ${label}` : source;
  return (
    <span
      className="label"
      style={{
        color,
        fontSize: 11,
        letterSpacing: "0.06em",
      }}
    >
      {text}
    </span>
  );
}
