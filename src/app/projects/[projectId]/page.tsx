import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { Score } from "@/components/score";
import { RefCard, cardKindFromCardType } from "@/components/ref-card";
import { ResendInviteButton } from "@/components/resend-invite-button";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups, getProject } from "@/lib/data";
import { analyzeTranscript, inviteMember } from "./actions";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, allGroups, project] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
    getProject(projectId),
  ]);
  const isOwner = project.members.some(
    (m) => m.userId === user.id && m.role === "OWNER",
  );
  const hasGithubSource = project.contributionSources.some(
    (s) => s.sourceType === "GITHUB",
  );
  const visibleReports = isOwner
    ? project.matchReports
    : project.matchReports.filter((r) => r.status === "PUBLISHED");
  const daysUntilDeadline = project.deadline
    ? Math.ceil(
        (project.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

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
          eyebrow={`Project · ${project.group.name}`}
          title={`${project.name}.`}
          sub={project.brief}
          right={
            isOwner ? (
              <a
                href="#analyze"
                className="pill"
                style={{ textDecoration: "none" }}
              >
                Analyse a transcript →
              </a>
            ) : null
          }
        />

        {/* Stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 56,
            paddingBottom: 60,
            borderBottom: "1px solid var(--line)",
          }}
        >
          <Stat
            label="Project health"
            value={project.healthScore}
            sub={
              daysUntilDeadline !== null
                ? deadlineSub(daysUntilDeadline)
                : "No deadline set"
            }
            color={
              project.healthScore >= 80
                ? "var(--ink)"
                : project.healthScore >= 60
                  ? "var(--status-watch)"
                  : "var(--red)"
            }
          />
          <Stat
            label="Members"
            value={project.members.length}
            sub={
              project.invites.length > 0
                ? `${project.invites.length} invite${project.invites.length === 1 ? "" : "s"} pending`
                : "All accepted"
            }
          />
          <Stat
            label="Reports filed"
            value={visibleReports.length}
            sub={
              isOwner && project.matchReports.length > visibleReports.length
                ? `${project.matchReports.length - visibleReports.length} drafted`
                : "Across all stand-ups"
            }
          />
        </section>

        {/* Leaderboard */}
        <section style={{ padding: "100px 0 0" }}>
          <div className="label" style={{ marginBottom: 32 }}>
            Leaderboard
          </div>
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
              <div>
                <div className="h-s">{m.user.name ?? m.user.email}</div>
                <div className="mute-ink" style={{ fontSize: 13 }}>
                  {m.role.toLowerCase()} · {m.user.email}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Score
                  value={m.contributionScore}
                  size={36}
                  color={
                    m.contributionScore > 0 ? "var(--ink)" : "var(--mute-2)"
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
          <p
            className="mute-ink"
            style={{ fontSize: 12, marginTop: 14 }}
          >
            Scores are the average across all published Match Reports.
          </p>
        </section>

        {/* Match reports */}
        <section style={{ padding: "100px 0 0" }}>
          <div className="label" style={{ marginBottom: 32 }}>
            Match reports
          </div>
          {visibleReports.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              {isOwner
                ? "No reports yet. Paste a transcript below to file the first one."
                : "No published reports yet. The project owner publishes after reviewing the AI-drafted cards."}
            </p>
          ) : (
            visibleReports.map((r, i) => (
              <Link
                key={r.id}
                href={`/projects/${project.id}/reports/${r.id}`}
                className="row-hover fade-up"
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 80px 28px",
                  gap: 32,
                  padding: "24px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "baseline",
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span
                  className="num"
                  style={{
                    fontSize: 14,
                    color: "var(--ink)",
                  }}
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
            ))
          )}
        </section>

        {/* Recent cards */}
        {project.cards.length > 0 && (
          <section style={{ padding: "100px 0 0" }}>
            <div className="label" style={{ marginBottom: 32 }}>
              Recent cards
            </div>
            {project.cards.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 140px",
                  gap: 32,
                  padding: "20px 0",
                  borderBottom: "1px solid var(--line-2)",
                  alignItems: "center",
                }}
              >
                <RefCard
                  kind={cardKindFromCardType(c.cardType)}
                  size={28}
                  rotate={c.cardType === "RED" ? 4 : c.cardType === "YELLOW" ? -4 : 0}
                />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    {c.user.name ?? c.user.email}
                  </div>
                  <div
                    className="mute-ink"
                    style={{ fontSize: 14, marginTop: 2 }}
                  >
                    {c.reason}
                  </div>
                </div>
                <span
                  className="mute-ink num"
                  style={{ textAlign: "right", fontSize: 12 }}
                >
                  {c.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Sprint progress (GitHub events) */}
        <section style={{ padding: "100px 0 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 32,
            }}
          >
            <div className="label">Sprint progress</div>
            {isOwner && (
              <Link
                href={`/projects/${project.id}/sources`}
                className="lk-mute"
                style={{ fontSize: 13 }}
              >
                Manage sources →
              </Link>
            )}
          </div>
          {project.contributionEvents.length === 0 ? (
            <div style={{ paddingTop: 8 }}>
              <p
                className="body mute-ink"
                style={{ margin: 0, marginBottom: 14 }}
              >
                {hasGithubSource
                  ? "GitHub source connected. Hit Sync on the sources page to pull recent commits and PRs."
                  : "Connect a GitHub repo to start tracking commits and PRs."}
              </p>
              {isOwner && (
                <Link
                  href={`/projects/${project.id}/sources`}
                  className="pill pill-ghost pill-sm"
                  style={{ textDecoration: "none" }}
                >
                  {hasGithubSource ? "Open sources" : "Connect GitHub"}
                </Link>
              )}
            </div>
          ) : (
            project.contributionEvents.map((e, i) => {
              const payload = e.payloadJson as {
                login?: string;
                message?: string;
                title?: string;
                url?: string;
                repo?: string;
              };
              const matched = e.userId
                ? project.members.find((m) => m.userId === e.userId)
                : null;
              const displayName = matched
                ? (matched.user.name ?? matched.user.email)
                : (payload.login ?? "unknown");
              return (
                <div
                  key={e.id}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 100px 160px 1fr",
                    gap: 32,
                    padding: "16px 0",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "baseline",
                    animationDelay: `${i * 24}ms`,
                  }}
                >
                  <span
                    className="mute-ink num"
                    style={{ fontSize: 12 }}
                  >
                    {e.occurredAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span
                    className="label"
                    style={{ color: "var(--red)" }}
                  >
                    {e.eventType}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName}
                  </span>
                  <a
                    href={payload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lk-mute"
                    style={{
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {payload.title ?? payload.message ?? "—"}
                  </a>
                </div>
              );
            })
          )}
        </section>

        {/* Invite */}
        <section style={{ padding: "100px 0 0", maxWidth: 720 }}>
          <div className="label" style={{ marginBottom: 24 }}>
            Invite a member
          </div>
          <form
            action={inviteMember}
            style={{ display: "flex", gap: 10 }}
          >
            <input type="hidden" name="projectId" value={project.id} />
            <input
              type="email"
              name="email"
              placeholder="teammate@example.com"
              required
              className="field"
              style={{ flex: 1 }}
            />
            <button type="submit" className="pill pill-sm">
              Send →
            </button>
          </form>
          <p
            className="mute-ink"
            style={{ fontSize: 13, marginTop: 10 }}
          >
            Recipient gets an email with a 7-day accept link.
          </p>

          {project.invites.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div
                className="label"
                style={{ marginBottom: 14, color: "var(--mute)" }}
              >
                Pending · {project.invites.length}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 0,
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
                      <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}>
                        <span className="mute-ink">Invite sent to </span>
                        <span style={{ fontWeight: 500 }}>{inv.email}</span>
                      </span>
                      <span
                        className="mute-ink num"
                        style={{ fontSize: 12 }}
                      >
                        {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                      </span>
                      <ResendInviteButton inviteId={inv.id} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Analyze (owner only) */}
        {isOwner && (
          <section
            id="analyze"
            style={{ padding: "100px 0 0" }}
          >
            <div className="label" style={{ marginBottom: 24 }}>
              Analyse a meeting transcript
            </div>
            <p
              className="body mute-ink"
              style={{ margin: 0, marginBottom: 24, maxWidth: 540 }}
            >
              Paste the transcript. The ref reads it against the project,
              quotes commitments verbatim, and drafts cards for whoever
              needs them.
            </p>
            <form action={analyzeTranscript} style={{ display: "grid", gap: 16 }}>
              <input type="hidden" name="projectId" value={project.id} />
              <textarea
                name="rawText"
                placeholder="[00:00] Maya: Atlas standup, May 9. Quick round.
[00:18] Maya: I'll have the API contract finalized by Thursday EOD."
                required
                rows={10}
                minLength={20}
                className="field field-lg num"
                style={{ resize: "vertical" }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <span className="mute-ink" style={{ fontSize: 13 }}>
                  Average time to verdict: 14 seconds.
                </span>
                <button type="submit" className="pill pill-red">
                  Analyse →
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function deadlineSub(daysUntil: number): string {
  if (daysUntil < 0)
    return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue`;
  if (daysUntil === 0) return "Due today";
  return `${daysUntil} day${daysUntil === 1 ? "" : "s"} left`;
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 16 }}>
        {label}
      </div>
      <Score value={value} size={88} color={color} />
      {sub && (
        <div
          className="mute-ink"
          style={{ fontSize: 14, marginTop: 10 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
