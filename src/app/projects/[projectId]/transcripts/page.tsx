import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { TranscriptUploadForm } from "@/components/transcript-upload-form";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectTranscripts } from "@/lib/data";

export default async function TranscriptsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, { project, isOwner, canRunAnalysis }] =
    await Promise.all([
      requireDbUser(),
      getNavContext({ projectId }),
      getProjectTranscripts(projectId),
    ]);
  const roleLabel = isOwner ? "Owner" : "Member";

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{
        id: project.id,
        name: project.name,
        deadlineIso: project.deadline?.toISOString() ?? null,
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Transcripts · ${project.name}`}
          title={
            project.transcripts.length === 0
              ? "Nothing's been refereed yet."
              : `${project.transcripts.length} meeting${project.transcripts.length === 1 ? "" : "s"} on file.`
          }
          sub="Drop a transcript and the ref drafts a Match Report. Key facts auto-flow into the Knowledge Base."
        />

        <section
          style={{
            padding: "8px 0 56px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div className="label">New transcript</div>
            <span
              className="mute-ink"
              style={{ fontSize: 11, letterSpacing: "0.04em" }}
              title={`You: ${user.email}`}
            >
              You · {roleLabel}
            </span>
          </div>
          {canRunAnalysis ? (
            <TranscriptUploadForm projectId={project.id} />
          ) : (
            <p
              role="alert"
              style={{
                fontSize: 14,
                margin: 0,
                padding: "16px 18px",
                border: "1px solid var(--line)",
                borderRadius: 6,
                background: "var(--paper)",
                maxWidth: 640,
              }}
            >
              You do not have permission to run analysis on this
              project.{" "}
              <span className="mute-ink" style={{ fontSize: 13 }}>
                Ask the project owner to enable{" "}
                <code style={{ fontSize: 12 }}>run_analysis</code> on
                your member row.
              </span>
            </p>
          )}
        </section>

        <section style={{ paddingTop: project.transcripts.length > 0 ? 40 : 0 }}>
          {project.transcripts.length === 0 ? null : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "180px 1fr 110px 110px 28px",
                  gap: 24,
                  padding: "16px 0",
                  color: "var(--mute)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span>When</span>
                <span>Title</span>
                <span style={{ textAlign: "right" }}>KB entries</span>
                <span>Report</span>
                <span />
              </div>
              {project.transcripts.map(
                (
                  t: {
                    id: string;
                    title: string | null;
                    meetingAt: Date | null;
                    createdAt: Date;
                    rawText: string;
                    source: string;
                    kbEntryCount: number;
                    uploader: { name: string | null; email: string };
                    matchReports: { id: string }[];
                  },
                  i: number,
                ) => {
                const report = t.matchReports[0];
                const when = t.meetingAt ?? t.createdAt;
                const fallbackTitle = `Meeting · ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
                const display = t.title ?? fallbackTitle;
                const snippet = t.rawText
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 200);
                return (
                  <article
                    key={t.id}
                    className="fade-up"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "180px 1fr 110px 110px 28px",
                      gap: 24,
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
                        {when.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div
                        className="mute-ink num"
                        style={{ fontSize: 11, marginTop: 4 }}
                      >
                        {when.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        by {t.uploader.name ?? t.uploader.email.split("@")[0]}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="h-s"
                        style={{
                          fontSize: 17,
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={display}
                      >
                        {display}
                      </div>
                      <div
                        className="body mute-ink"
                        style={{
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
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
                    <div
                      className="num"
                      style={{
                        textAlign: "right",
                        fontSize: 18,
                        color:
                          t.kbEntryCount > 0
                            ? "var(--ink)"
                            : "var(--mute-2)",
                      }}
                    >
                      {t.kbEntryCount || "—"}
                    </div>
                    <div>
                      {report ? (
                        <Link
                          href={`/projects/${project.id}/reports/${report.id}`}
                          className="lk-mute"
                          style={{ fontSize: 13 }}
                        >
                          View
                        </Link>
                      ) : (
                        <span
                          className="mute-ink"
                          style={{ fontSize: 12 }}
                        >
                          —
                        </span>
                      )}
                    </div>
                    <span
                      className="mute-ink"
                      style={{ fontSize: 16, textAlign: "right" }}
                    >
                      {report ? "→" : ""}
                    </span>
                  </article>
                );
              })}
            </>
          )}
        </section>
      </main>
    </AppShell>
  );
}
