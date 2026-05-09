import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CapabilityPanel } from "@/components/capability-panel";
import { NudgeButton } from "@/components/nudge-button";
import { PageHead } from "@/components/page-head";
import { Score } from "@/components/score";
import { ResendInviteButton } from "@/components/resend-invite-button";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectMembers } from "@/lib/data";
import { InviteForm } from "@/components/invite-form";
import { cancelInvite } from "../actions";

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

  const viewerMembership = project.members.find(
    (m) => m.userId === user.id,
  );
  const viewerIsOwner = viewerMembership?.role === "OWNER";

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
          eyebrow={`Members · ${project.name}`}
          title={`${project.members.length} on the squad.`}
          sub={
            viewerIsOwner
              ? "Click any row to see and adjust that member's capabilities. Owner permissions are locked on."
              : "Click your row to review your capabilities on this project."
          }
          right={
            viewerIsOwner ? (
              <InviteForm projectId={project.id} />
            ) : null
          }
        />

        <section>
          {project.members.map((m, i) => {
            const isViewer = m.userId === user.id;
            // Owner can edit any non-owner row's caps. Members can
            // open their own row but only see read-only state.
            const canExpand = viewerIsOwner || isViewer;
            const canEdit =
              viewerIsOwner && m.role !== "OWNER" && !isViewer;

            const summary = (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "60px 1fr 100px 110px 110px 28px",
                  gap: 24,
                  padding: "26px 0",
                  alignItems: "center",
                  cursor: canExpand ? "pointer" : "default",
                  listStyle: "none",
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
                    {isViewer && (
                      <span
                        className="mute-ink"
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          marginLeft: 8,
                        }}
                      >
                        (you)
                      </span>
                    )}
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
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {!isViewer && (
                    <NudgeButton
                      projectId={project.id}
                      recipientUserId={m.userId}
                      recipientName={m.user.name ?? m.user.email}
                      recipientScore={m.contributionScore}
                      size="sm"
                    />
                  )}
                </div>
                <div
                  className="mute-ink"
                  style={{
                    textAlign: "right",
                    visibility: canExpand ? "visible" : "hidden",
                  }}
                  aria-hidden={!canExpand}
                >
                  <ChevronDown size={16} />
                </div>
              </div>
            );

            return (
              <div
                key={m.id}
                className="fade-up"
                style={{
                  borderBottom: "1px solid var(--line)",
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {canExpand ? (
                  <details>
                    <summary
                      style={{ listStyle: "none", cursor: "pointer" }}
                    >
                      {summary}
                    </summary>
                    <div style={{ paddingBottom: 24 }}>
                      <CapabilityPanel
                        projectId={project.id}
                        projectMemberId={m.id}
                        memberRole={m.role}
                        storedCapabilities={m.capabilities}
                        viewerCanEdit={canEdit}
                      />
                    </div>
                  </details>
                ) : (
                  summary
                )}
              </div>
            );
          })}
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
                    {viewerIsOwner && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <ResendInviteButton inviteId={inv.id} />
                        <form action={cancelInvite}>
                          <input type="hidden" name="inviteId" value={inv.id} />
                          <button
                            type="submit"
                            className="lk-mute"
                            style={{ fontSize: 12 }}
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    )}
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
