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
                ? "Run a transcript analysis from the project overview to draft your first."
                : "The owner files reports after each meeting. Check back after the next stand-up."
              : isOwner && draftCount > 0
                ? `${draftCount} draft${draftCount === 1 ? "" : "s"} awaiting review.`
                : "Newest first."
          }
          right={
            isOwner ? (
              <Link
                href={`/projects/${project.id}#analyze`}
                className="pill pill-ghost pill-sm"
                style={{ textDecoration: "none" }}
              >
                + Analyse a transcript
              </Link>
            ) : null
          }
        />

        <section>
          {reports.map((r, i) => (
            <Link
              key={r.id}
              href={`/projects/${project.id}/reports/${r.id}`}
              className="row-hover fade-up"
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 90px 80px 28px",
                gap: 32,
                padding: "24px 0",
                borderBottom: "1px solid var(--line)",
                alignItems: "baseline",
                animationDelay: `${Math.min(i, 12) * 30}ms`,
              }}
            >
              <span
                className="num"
                style={{ fontSize: 14, color: "var(--ink)" }}
              >
                {r.createdAt.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span
                className="body"
                style={{
                  fontSize: 15,
                  color: "var(--ink-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {r.summary}
              </span>
              <span
                className="num mute-ink"
                style={{ textAlign: "right", fontSize: 13 }}
              >
                {r._count.cards} card{r._count.cards === 1 ? "" : "s"}
              </span>
              <span
                className="label"
                style={{
                  color:
                    r.status === "DRAFT" ? "var(--mute)" : "var(--ink)",
                }}
              >
                {r.status}
              </span>
              <span
                className="mute-ink"
                style={{ fontSize: 16, textAlign: "right" }}
              >
                →
              </span>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
