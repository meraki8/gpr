import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectTranscripts } from "@/lib/data";

export default async function TranscriptsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, { project, isOwner }] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectTranscripts(projectId),
  ]);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{ id: project.id, name: project.name }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Transcripts · ${project.name}`}
          title={
            project.transcripts.length === 0
              ? "Nothing's been refereed yet."
              : `${project.transcripts.length} meeting${project.transcripts.length === 1 ? "" : "s"} on file.`
          }
          sub={
            project.transcripts.length === 0
              ? "Paste a transcript on the project overview page to file the first match report."
              : "Each one was the input to a match report. Newest first."
          }
          right={
            isOwner ? (
              <Link
                href={`/projects/${project.id}#analyze`}
                className="pill pill-ghost pill-sm"
                style={{ textDecoration: "none" }}
              >
                + New transcript
              </Link>
            ) : null
          }
        />

        <section>
          {project.transcripts.map((t, i) => {
            const report = t.matchReports[0];
            const snippet = t.rawText
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 220);
            return (
              <article
                key={t.id}
                className="fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 140px",
                  gap: 32,
                  padding: "26px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "baseline",
                  animationDelay: `${Math.min(i, 12) * 30}ms`,
                }}
              >
                <div>
                  <div
                    className="num"
                    style={{ fontSize: 14, color: "var(--ink)" }}
                  >
                    {t.createdAt.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div
                    className="mute-ink"
                    style={{ fontSize: 12, marginTop: 4 }}
                  >
                    by {t.uploader.name ?? t.uploader.email}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    className="body"
                    style={{
                      fontSize: 14,
                      color: "var(--ink-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {snippet}
                    {t.rawText.length > snippet.length ? "…" : ""}
                  </div>
                  <div
                    className="mute-ink num"
                    style={{ fontSize: 11, marginTop: 6 }}
                  >
                    {t.rawText.length.toLocaleString()} chars · {t.source}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {report ? (
                    <Link
                      href={`/projects/${project.id}/reports/${report.id}`}
                      className="lk-mute"
                      style={{ fontSize: 13 }}
                    >
                      {report.status === "DRAFT"
                        ? "View draft →"
                        : "View report →"}
                    </Link>
                  ) : (
                    <span
                      className="mute-ink"
                      style={{ fontSize: 12 }}
                    >
                      No report
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
