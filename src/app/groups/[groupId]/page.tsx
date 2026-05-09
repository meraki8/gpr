import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { Status } from "@/components/status";
import { requireDbUser } from "@/lib/auth";
import { getGroup, getMyGroups } from "@/lib/data";
import { createProject } from "./actions";

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

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const [user, allGroups, group] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
    getGroup(groupId),
  ]);

  return (
    <AppShell user={user} groups={allGroups} currentGroupId={group.id}>
      <main className="wrap-w" style={{ paddingBottom: 120 }}>
        <PageHead
          eyebrow={`Group · ${group.members.length} member${group.members.length === 1 ? "" : "s"}`}
          title={`${group.name}.`}
          sub={
            group.projects.length === 0
              ? "No projects yet. Add one below to start refereeing."
              : `${group.projects.length} active project${group.projects.length === 1 ? "" : "s"}.`
          }
          right={
            <a
              href="#new-project"
              className="pill pill-ghost pill-sm"
              style={{ textDecoration: "none" }}
            >
              + New project
            </a>
          }
        />

        {group.projects.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 90px 90px 130px 110px 28px",
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
              <span style={{ textAlign: "right" }}>Health</span>
              <span style={{ textAlign: "right" }}>Members</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>Deadline</span>
              <span />
            </div>
            {group.projects.map((p, i) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="row-hover fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 90px 90px 130px 110px 28px",
                  gap: 24,
                  padding: "28px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "center",
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <div>
                  <div className="h-s">{p.name}</div>
                  <div
                    className="mute-ink"
                    style={{
                      fontSize: 13,
                      marginTop: 2,
                      maxWidth: 540,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.brief}
                  </div>
                </div>
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
                  className="num mute-ink"
                  style={{ textAlign: "right", fontSize: 15 }}
                >
                  —
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
            ))}
          </>
        )}

        {/* Members */}
        <section style={{ marginTop: 80 }}>
          <div className="label" style={{ marginBottom: 24 }}>
            Group members
          </div>
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 24,
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {group.members.map((m) => (
              <li key={m.id}>
                <div className="h-s" style={{ marginBottom: 4 }}>
                  {m.user.name ?? m.user.email}
                </div>
                <div className="mute-ink" style={{ fontSize: 13 }}>
                  {m.role.toLowerCase()} · {m.user.email}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Create project */}
        <section
          id="new-project"
          style={{ marginTop: 100, maxWidth: 720 }}
        >
          <div className="label" style={{ marginBottom: 24 }}>
            New project
          </div>
          <form action={createProject} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="groupId" value={group.id} />
            <input
              type="text"
              name="name"
              placeholder="Project name"
              required
              maxLength={100}
              className="field"
            />
            <textarea
              name="brief"
              placeholder="Brief — what is this project, what does success look like?"
              required
              rows={4}
              className="field field-lg"
            />
            <div
              style={{ display: "flex", gap: 14, alignItems: "center" }}
            >
              <label className="label" style={{ marginRight: 8 }}>
                Deadline
              </label>
              <input
                type="date"
                name="deadline"
                className="field"
                style={{ width: 220, padding: "10px 14px" }}
              />
              <button
                type="submit"
                className="pill"
                style={{ marginLeft: "auto" }}
              >
                Create project →
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
