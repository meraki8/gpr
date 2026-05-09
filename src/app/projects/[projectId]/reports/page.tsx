import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectReportsList } from "@/lib/data";

export default async function ReportsIndexPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, { project, isOwner, reports }] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectReportsList(projectId),
  ]);

  const draftCount = reports.filter((r) => r.status === "DRAFT").length;
  const roleLabel = isOwner ? "Owner" : "Member";

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
          eyebrow={`Match reports · ${project.name}`}
          title={
            reports.length === 0
              ? "No reports filed."
              : `${reports.length} report${reports.length === 1 ? "" : "s"} on record.`
          }
          sub={
            reports.length === 0
              ? isOwner
                ? "Run a transcript analysis from the Transcripts tab to draft your first."
                : "Drafts only show to the project owner. You'll see reports here once they're published."
              : isOwner && draftCount > 0
                ? `${draftCount} draft${draftCount === 1 ? "" : "s"} awaiting review.`
                : "Newest first."
          }
          right={
            <span
              className="mute-ink"
              style={{ fontSize: 11, letterSpacing: "0.04em" }}
              title={`You: ${user.email}`}
            >
              You · {roleLabel}
            </span>
          }
        />

        {/* Column headers */}
        {reports.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1fr) 140px 90px 100px 28px",
              gap: 24,
              padding: "16px 0 8px",
              color: "var(--mute)",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span>Meeting</span>
            <span>Date</span>
            <span style={{ textAlign: "right" }}>Cards</span>
            <span>Status</span>
            <span />
          </div>
        )}

        <section>
          {reports.map((r, i) => {
            const meetingTime = r.transcript?.meetingAt ?? r.createdAt;
            const fallbackTitle = `Meeting · ${meetingTime.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
            const title = r.transcript?.title ?? fallbackTitle;
            const cards = r._count.cards;
            const isDraft = r.status === "DRAFT";

            return (
              <Link
                key={r.id}
                href={`/projects/${project.id}/reports/${r.id}`}
                className="row-hover fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) 140px 90px 100px 28px",
                  gap: 24,
                  padding: "20px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "center",
                  animationDelay: `${Math.min(i, 12) * 30}ms`,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    className="h-s"
                    style={{
                      fontSize: 16,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--ink)",
                    }}
                    title={title}
                  >
                    {title}
                  </div>
                  <div
                    className="mute-ink"
                    style={{
                      fontSize: 13,
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {r.summary}
                  </div>
                </div>
                <div
                  className="num"
                  style={{ fontSize: 13, color: "var(--ink-2)" }}
                >
                  {meetingTime.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div
                  className="num"
                  style={{
                    textAlign: "right",
                    fontSize: 18,
                    color: cards > 0 ? "var(--red)" : "var(--mute-2)",
                  }}
                >
                  {cards || "—"}
                </div>
                <StatusBadge draft={isDraft} />
                <span
                  className="mute-ink"
                  style={{ fontSize: 16, textAlign: "right" }}
                >
                  →
                </span>
              </Link>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}

function StatusBadge({ draft }: { draft: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        background: draft ? "transparent" : "var(--status-good)",
        color: draft ? "var(--mute)" : "#fff",
        border: draft ? "1px solid var(--line)" : "1px solid transparent",
        whiteSpace: "nowrap",
      }}
    >
      {draft ? "Draft" : "Published"}
    </span>
  );
}
