import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { Score } from "@/components/score";
import { ResendInviteButton } from "@/components/resend-invite-button";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectMembers } from "@/lib/data";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, project] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectMembers(projectId),
  ]);

  const isOwner = project.members.some(
    (m) => m.userId === user.id && m.role === "OWNER",
  );

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
          eyebrow={`Members · ${project.name}`}
          title={`${project.members.length} on the squad.`}
          sub="Sorted by contribution score across all published reports. Ties go to the earliest joiner."
        />

        <section>
          {project.members.map((m, i) => (
            <div
              key={m.id}
              className="fade-up"
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 100px 110px",
                gap: 32,
                padding: "26px 0",
                borderBottom: "1px solid var(--line)",
                alignItems: "center",
                animationDelay: `${i * 40}ms`,
              }}
            >
              <span
                className="num display"
                style={{
                  fontSize: 30,
                  color:
                    i === 0 && m.contributionScore > 0
                      ? "var(--ink)"
                      : "var(--mute-2)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  className="h-s"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.user.name ?? m.user.email}
                </div>
                <div className="mute-ink" style={{ fontSize: 13 }}>
                  {m.role.toLowerCase()} · {m.user.email}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Score
                  value={m.contributionScore}
                  size={36}
                  color={
                    m.contributionScore > 0
                      ? "var(--ink)"
                      : "var(--mute-2)"
                  }
                />
              </div>
              <div
                className="mute-ink num"
                style={{ textAlign: "right", fontSize: 13 }}
              >
                joined{" "}
                {m.joinedAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ))}
        </section>

        {project.invites.length > 0 && (
          <section style={{ paddingTop: 80, maxWidth: 720 }}>
            <div
              className="label"
              style={{ marginBottom: 18, color: "var(--mute)" }}
            >
              Pending invites · {project.invites.length}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid var(--line-2)",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{ fontSize: 14, flex: 1, minWidth: 0 }}
                    >
                      <span className="mute-ink">Invite sent to </span>
                      <span style={{ fontWeight: 500 }}>{inv.email}</span>
                    </span>
                    <span
                      className="mute-ink num"
                      style={{ fontSize: 12 }}
                    >
                      {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                    </span>
                    {isOwner && <ResendInviteButton inviteId={inv.id} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
}
