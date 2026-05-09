import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { Status } from "@/components/status";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups, getMyProjects } from "@/lib/data";
import { createGroup } from "./actions";

function statusFromHealth(score: number): "good" | "watch" | "risk" {
  if (score >= 80) return "good";
  if (score >= 60) return "watch";
  return "risk";
}
function colorForHealth(score: number): string {
  if (score >= 80) return "var(--ink)";
  if (score >= 60) return "#c89014";
  return "var(--red)";
}

export default async function DashboardPage() {
  const [user, groups, allProjects] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
    getMyProjects(),
  ]);

  const ownedProjects = allProjects.filter(
    (p) => p.group.ownerId === user.id,
  );
  const invitedProjects = allProjects.filter(
    (p) => p.group.ownerId !== user.id,
  );

  return (
    <AppShell user={user} groups={groups}>
      <main className="wrap-w" style={{ paddingBottom: 120 }}>
        <PageHead
          eyebrow={
            allProjects.length > 0
              ? `${allProjects.length} project${allProjects.length === 1 ? "" : "s"} active`
              : "Welcome"
          }
          title={`Hey, ${user.name?.split(" ")[0] ?? "there"}.`}
          sub="Health, cards, and what the ref last saw."
        />

        {allProjects.length === 0 ? (
          <EmptyState groups={groups} />
        ) : (
          <>
            {ownedProjects.length > 0 && (
              <ProjectSection
                eyebrow="Your groups"
                sub="Projects in groups you own."
                projects={ownedProjects}
              />
            )}

            {invitedProjects.length > 0 && (
              <ProjectSection
                eyebrow="Projects you're in"
                sub="Projects you were invited to. The owner runs the analyses; you see published reports."
                projects={invitedProjects}
                showGroupColumn
                topPad={ownedProjects.length > 0}
              />
            )}
          </>
        )}

        <section style={{ marginTop: 80, maxWidth: 480 }}>
          <div className="label" style={{ marginBottom: 18 }}>
            New group
          </div>
          <form action={createGroup} style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              name="name"
              placeholder="e.g. Capstone Squad"
              required
              maxLength={100}
              className="field"
              style={{ flex: 1 }}
            />
            <button type="submit" className="pill pill-sm">
              Create →
            </button>
          </form>
          <p
            className="mute-ink"
            style={{ fontSize: 13, marginTop: 10 }}
          >
            Groups hold one or more projects. You become the owner.
          </p>
        </section>
      </main>
    </AppShell>
  );
}

type ProjectRow = Awaited<ReturnType<typeof getMyProjects>>[number];

function ProjectSection({
  eyebrow,
  sub,
  projects,
  showGroupColumn,
  topPad,
}: {
  eyebrow: string;
  sub?: string;
  projects: ProjectRow[];
  showGroupColumn?: boolean;
  topPad?: boolean;
}) {
  const cols = showGroupColumn
    ? "1fr 140px 90px 90px 130px 110px 28px"
    : "1fr 90px 90px 130px 110px 28px";
  return (
    <section style={{ marginTop: topPad ? 80 : 0, marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div className="label">{eyebrow}</div>
        {sub && (
          <div
            className="mute-ink"
            style={{ fontSize: 13, maxWidth: 540, textAlign: "right" }}
          >
            {sub}
          </div>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 24,
          padding: "16px 0",
          color: "var(--mute)",
          fontSize: 12,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span>Project</span>
        {showGroupColumn && <span>Group</span>}
        <span style={{ textAlign: "right" }}>Health</span>
        <span style={{ textAlign: "right" }}>Cards</span>
        <span>Status</span>
        <span style={{ textAlign: "right" }}>Deadline</span>
        <span />
      </div>
      {projects.map((p, i) => {
        const cardsCount = p._count.cards;
        const reports = p._count.matchReports;
        return (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="row-hover fade-up"
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 24,
              padding: "28px 0",
              borderBottom: "1px solid var(--line)",
              alignItems: "center",
              animationDelay: `${i * 50}ms`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="h-s" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div
                className="mute-ink"
                style={{
                  fontSize: 13,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {reports > 0
                  ? `${reports} report${reports === 1 ? "" : "s"} published`
                  : "No reports yet"}
              </div>
            </div>
            {showGroupColumn && (
              <div
                style={{
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.group.name}
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <span
                className="num display"
                style={{
                  fontSize: 30,
                  color: colorForHealth(p.healthScore),
                }}
              >
                {p.healthScore}
              </span>
            </div>
            <div
              className="num"
              style={{
                textAlign: "right",
                fontSize: 18,
                color:
                  cardsCount > 0 ? "var(--red)" : "var(--mute-2)",
              }}
            >
              {cardsCount || "—"}
            </div>
            <Status kind={statusFromHealth(p.healthScore)} />
            <div
              className="mute-ink num"
              style={{ textAlign: "right", fontSize: 13 }}
            >
              {p.deadline
                ? p.deadline.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </div>
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
  );
}

function EmptyState({
  groups,
}: {
  groups: { id: string; name: string }[];
}) {
  return (
    <div
      className="fade-up"
      style={{ padding: "40px 0 80px", maxWidth: 540 }}
    >
      <p className="body-lg" style={{ marginTop: 0 }}>
        No projects yet.{" "}
        {groups.length > 0
          ? "Open one of your groups to add a project, or wait for an invite."
          : "Create a group below, then add a project under it. Or accept an invite from a teammate."}
      </p>
      {groups.length > 0 && (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {groups.slice(0, 3).map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="pill pill-ghost pill-sm"
              style={{ textDecoration: "none" }}
            >
              {g.name} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
