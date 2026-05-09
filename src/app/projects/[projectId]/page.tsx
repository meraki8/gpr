import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  FileText,
  GitCommit,
  ScrollText,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExpandableBrief } from "@/components/overview/expandable-brief";
import { LiveCountdown } from "@/components/overview/live-countdown";
import { AskGprTrigger } from "@/components/overview/ask-gpr-trigger";
import { RefCard, cardKindFromCardType } from "@/components/ref-card";
import { Score } from "@/components/score";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectOverview } from "@/lib/data";

type Overview = Awaited<ReturnType<typeof getProjectOverview>>;
type Activity = Overview["timeline"][number];
type Commitment = Overview["commitments"][number];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, overview] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectOverview(projectId),
  ]);
  const {
    project,
    isOwner,
    counts,
    latestReport,
    timeline,
    commitments,
    cardCountsByUser,
  } = overview;
  const top3 = project.members.slice(0, 3);
  const renderTimeMs = new Date().getTime();

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
      <main
        className="wrap-w fade-up"
        style={{ paddingTop: 32, paddingBottom: 160 }}
      >
        {/* ============== SECTION 1 — HEADER ============== */}
        <ProjectHeader
          project={project}
          counts={counts}
          isOwner={isOwner}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)",
            gap: 40,
            marginTop: 56,
          }}
          className="overview-grid"
        >
          {/* ============== LEFT COLUMN ============== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
            <LatestReport
              project={project}
              latestReport={latestReport}
              isOwner={isOwner}
            />
            <ActivityFeed timeline={timeline} />
          </div>

          {/* ============== RIGHT COLUMN ============== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <QuickActions projectId={project.id} />
            <LeaderboardSnapshot
              projectId={project.id}
              members={top3}
              cards={latestReport?.cards ?? []}
              allCardsByUser={cardCountsByUser}
            />
            <OpenCommitments
              projectId={project.id}
              commitments={commitments}
              renderTimeMs={renderTimeMs}
            />
          </div>
        </div>
      </main>

      {/* Mobile collapse: stack columns at narrow widths. */}
      <style>{`
        @media (max-width: 880px) {
          .overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppShell>
  );
}

// ============== HEADER ==============

function ProjectHeader({
  project,
  counts,
  isOwner,
}: {
  project: Overview["project"];
  counts: Overview["counts"];
  isOwner: boolean;
}) {
  const healthColor =
    project.healthScore >= 80
      ? "var(--status-good, #16a34a)"
      : project.healthScore >= 50
        ? "var(--status-watch, #d97706)"
        : "var(--red)";
  return (
    <section>
      <div className="label" style={{ marginBottom: 14 }}>
        Project · {project.group.name}
        {isOwner && <span style={{ marginLeft: 10 }}>· you own this</span>}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 40,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            className="display"
            style={{
              fontSize: "clamp(40px, 5.4vw, 64px)",
              margin: 0,
              fontWeight: 500,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
            }}
          >
            {project.name}
          </h1>
          <div style={{ marginTop: 16, maxWidth: 640 }}>
            <ExpandableBrief brief={project.brief} />
          </div>
          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              className="label"
              style={{ color: "var(--mute)", letterSpacing: "0.12em" }}
            >
              Deadline
            </span>
            <span style={{ fontSize: 16 }}>
              {project.deadline ? (
                <LiveCountdown deadline={project.deadline.toISOString()} />
              ) : (
                <span className="mute-ink">No deadline set</span>
              )}
            </span>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "20px 22px",
            background: "var(--paper)",
          }}
        >
          <div className="label" style={{ marginBottom: 12 }}>
            Project health
          </div>
          <Score value={project.healthScore} size={84} color={healthColor} />
          <div
            className="mute-ink"
            style={{ fontSize: 12, marginTop: 12, lineHeight: 1.45 }}
          >
            {project.healthScore >= 80
              ? "Squad's pulling. Keep it up."
              : project.healthScore >= 50
                ? "Mixed signals. Time for a stand-up."
                : "Red zone. Someone needs to step up."}
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div
        style={{
          marginTop: 36,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
        className="quick-stats"
      >
        <QuickStat
          icon={<Users size={14} strokeWidth={2.2} />}
          label="Members"
          value={counts.members}
        />
        <QuickStat
          icon={<ScrollText size={14} strokeWidth={2.2} />}
          label="Meetings analysed"
          value={counts.meetings}
        />
        <QuickStat
          icon={<Trophy size={14} strokeWidth={2.2} />}
          label="Cards issued"
          value={counts.cards}
        />
        <QuickStat
          icon={<BookOpen size={14} strokeWidth={2.2} />}
          label="KB entries"
          value={counts.kb}
        />
      </div>
      <style>{`
        @media (max-width: 720px) {
          .quick-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "14px 16px",
        background: "var(--paper)",
      }}
    >
      <div
        className="label"
        style={{
          marginBottom: 8,
          color: "var(--mute)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        className="num display"
        style={{
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 500,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============== LATEST REPORT ==============

function LatestReport({
  project,
  latestReport,
  isOwner,
}: {
  project: Overview["project"];
  latestReport: Overview["latestReport"];
  isOwner: boolean;
}) {
  if (!latestReport) {
    return (
      <section>
        <div className="label" style={{ marginBottom: 18 }}>
          Latest match report
        </div>
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: 12,
            padding: "32px 28px",
            background: "var(--paper)",
          }}
        >
          <p
            className="body"
            style={{ margin: 0, marginBottom: 18, maxWidth: 480 }}
          >
            No meetings analysed yet. Upload your first transcript to get
            started.
          </p>
          {isOwner && (
            <Link
              href={`/projects/${project.id}/transcripts`}
              className="pill pill-red"
              style={{ textDecoration: "none", padding: "10px 18px" }}
            >
              Upload transcript →
            </Link>
          )}
        </div>
      </section>
    );
  }

  const cardsByUser = new Map<string, typeof latestReport.cards>();
  for (const c of latestReport.cards) {
    const list = cardsByUser.get(c.userId) ?? [];
    list.push(c);
    cardsByUser.set(c.userId, list);
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div className="label">Latest match report</div>
        <Link
          href={`/projects/${project.id}/reports/${latestReport.id}`}
          className="lk-mute"
          style={{ fontSize: 13 }}
        >
          View full report →
        </Link>
      </div>
      <article
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "22px 24px",
          background: "var(--paper)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div className="h-s" style={{ fontSize: 17 }}>
            Sprint recap
          </div>
          <div className="mute-ink num" style={{ fontSize: 12 }}>
            {latestReport.createdAt.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
        <p
          className="body"
          style={{
            margin: 0,
            marginBottom: 22,
            color: "var(--ink-2)",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {latestReport.summary}
        </p>
        <div
          className="label"
          style={{ marginBottom: 12, color: "var(--mute)" }}
        >
          Top scorers · this report
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {latestReport.memberReports.map((mr, i) => {
            const cards = cardsByUser.get(mr.userId) ?? [];
            return (
              <li
                key={mr.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px minmax(0, 1fr) auto auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop:
                    i === 0 ? "1px solid var(--line)" : undefined,
                  borderBottom: "1px solid var(--line-2)",
                }}
              >
                <span
                  className="num display"
                  style={{
                    fontSize: 18,
                    color: "var(--mute-2)",
                    fontWeight: 500,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {mr.user.name ?? mr.user.email}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  {cards.slice(0, 3).map((c) => (
                    <RefCard
                      key={c.id}
                      kind={cardKindFromCardType(c.cardType)}
                      size={14}
                    />
                  ))}
                </span>
                <span
                  className="num"
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    minWidth: 36,
                    textAlign: "right",
                    color: "var(--ink)",
                  }}
                >
                  {mr.contributionScore}
                </span>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}

// ============== ACTIVITY FEED ==============

function ActivityFeed({ timeline }: { timeline: Activity[] }) {
  return (
    <section>
      <div className="label" style={{ marginBottom: 18 }}>
        Recent activity
      </div>
      {timeline.length === 0 ? (
        <p className="mute-ink body">Nothing has happened yet. Wild.</p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            position: "relative",
          }}
        >
          {timeline.map((item, i) => (
            <ActivityRow key={item.key} item={item} isLast={i === timeline.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityRow({
  item,
  isLast,
}: {
  item: Activity;
  isLast: boolean;
}) {
  const meta = activityMeta(item.kind);
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "36px minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "flex-start",
        padding: "12px 0",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 36,
          minHeight: 36,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 14,
            bottom: isLast ? "50%" : -14,
            width: 2,
            background: "var(--line)",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "var(--paper)",
            border: `1px solid ${meta.tint}`,
            color: meta.tint,
          }}
        >
          {meta.icon}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {renderActivityTitle(item)}
        </div>
        {item.detail && (
          <div
            className="mute-ink"
            style={{
              fontSize: 13,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {item.detail}
          </div>
        )}
      </div>
      <span
        className="mute-ink num"
        style={{
          fontSize: 12,
          whiteSpace: "nowrap",
          marginTop: 8,
        }}
        title={item.at.toLocaleString()}
      >
        {timeAgo(item.at)}
      </span>
    </li>
  );
}

function renderActivityTitle(item: Activity) {
  const actor = item.actor;
  switch (item.kind) {
    case "transcript":
      return (
        <>
          Transcript uploaded
          {actor && (
            <span className="mute-ink" style={{ fontWeight: 400 }}>
              {" "}
              by {actor}
            </span>
          )}
        </>
      );
    case "card":
      return (
        <>
          {item.title.charAt(0).toUpperCase() + item.title.slice(1)}
          {actor && (
            <span className="mute-ink" style={{ fontWeight: 400 }}>
              {" "}
              to {actor}
            </span>
          )}
        </>
      );
    case "kb":
      return <>KB entry · {item.title}</>;
    case "join":
      return (
        <>
          {actor ?? "Someone"}{" "}
          <span className="mute-ink" style={{ fontWeight: 400 }}>
            joined the project
          </span>
        </>
      );
    case "github":
      return (
        <>
          {item.title}
          {actor && (
            <span className="mute-ink" style={{ fontWeight: 400 }}>
              {" "}
              by @{actor}
            </span>
          )}
        </>
      );
    case "report":
      return <>Match report published</>;
  }
}

function activityMeta(kind: Activity["kind"]) {
  switch (kind) {
    case "transcript":
      return { icon: <ScrollText size={14} />, tint: "var(--ink)" };
    case "card":
      return { icon: <Trophy size={14} />, tint: "var(--red)" };
    case "kb":
      return { icon: <BookOpen size={14} />, tint: "var(--ink-2)" };
    case "join":
      return { icon: <UserPlus size={14} />, tint: "var(--ink-2)" };
    case "github":
      return { icon: <GitCommit size={14} />, tint: "var(--ink)" };
    case "report":
      return { icon: <FileText size={14} />, tint: "var(--red)" };
  }
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ============== LEADERBOARD SNAPSHOT ==============

function LeaderboardSnapshot({
  projectId,
  members,
  allCardsByUser,
}: {
  projectId: string;
  members: Overview["project"]["members"];
  cards: NonNullable<Overview["latestReport"]>["cards"];
  allCardsByUser: Map<string, { mvp: number; y: number; r: number }>;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="label">Leaderboard</div>
        <Link
          href={`/projects/${projectId}/leaderboard`}
          className="lk-mute"
          style={{ fontSize: 13 }}
        >
          View full leaderboard →
        </Link>
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "8px 16px",
          background: "var(--paper)",
        }}
      >
        {members.map((m, i) => {
          const counts = allCardsByUser.get(m.userId) ?? {
            mvp: 0,
            y: 0,
            r: 0,
          };
          return (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "28px minmax(0, 1fr) auto auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 0",
                borderBottom:
                  i === members.length - 1
                    ? undefined
                    : "1px solid var(--line-2)",
              }}
            >
              <span
                className="num display"
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color:
                    i === 0
                      ? "var(--ink)"
                      : "var(--mute-2, var(--mute))",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.user.name ?? m.user.email}
                </div>
                <div className="mute-ink" style={{ fontSize: 11 }}>
                  {m.role.toLowerCase()}
                </div>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  gap: 3,
                  alignItems: "center",
                }}
              >
                {Array.from({ length: Math.min(counts.mvp, 3) }).map((_, k) => (
                  <RefCard key={`m${k}`} kind="mvp" size={12} />
                ))}
                {Array.from({ length: Math.min(counts.y, 3) }).map((_, k) => (
                  <RefCard key={`y${k}`} kind="y" size={12} />
                ))}
                {Array.from({ length: Math.min(counts.r, 3) }).map((_, k) => (
                  <RefCard key={`r${k}`} kind="r" size={12} />
                ))}
              </span>
              <span
                className="num display"
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  minWidth: 38,
                  textAlign: "right",
                  color:
                    m.contributionScore > 0
                      ? "var(--ink)"
                      : "var(--mute-2, var(--mute))",
                }}
              >
                {m.contributionScore}
              </span>
            </div>
          );
        })}
        {members.length === 0 && (
          <div
            className="mute-ink body"
            style={{ padding: "20px 0", textAlign: "center" }}
          >
            No members yet.
          </div>
        )}
      </div>
    </section>
  );
}

// ============== OPEN COMMITMENTS ==============

function OpenCommitments({
  projectId,
  commitments,
  renderTimeMs,
}: {
  projectId: string;
  commitments: Commitment[];
  renderTimeMs: number;
}) {
  const visible = commitments.slice(0, 6);
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="label">Open commitments</div>
        <Link
          href={`/projects/${projectId}/kb`}
          className="lk-mute"
          style={{ fontSize: 13 }}
        >
          View all in KB →
        </Link>
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "var(--paper)",
        }}
      >
        {visible.length === 0 ? (
          <p
            className="mute-ink body"
            style={{ margin: 0, padding: "20px 18px", fontSize: 14 }}
          >
            No open commitments yet.
          </p>
        ) : (
          visible.map((c, i) => {
            const overdue = c.targetDate.getTime() < renderTimeMs;
            return (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom:
                    i === visible.length - 1
                      ? undefined
                      : "1px solid var(--line-2)",
                }}
              >
                <Avatar member={c.assignee} fallback={c.assignedTo} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      lineHeight: 1.35,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    className="mute-ink"
                    style={{ fontSize: 12, marginTop: 2 }}
                  >
                    {c.assignee?.name ?? c.assignedTo ?? "unassigned"}
                  </div>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: overdue ? "var(--red)" : "var(--mute)",
                    whiteSpace: "nowrap",
                  }}
                  title={c.targetDate.toLocaleString()}
                >
                  {overdue && (
                    <AlertTriangle size={13} strokeWidth={2.4} />
                  )}
                  {dueLabel(c.targetDate)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function dueLabel(date: Date) {
  const diff = date.getTime() - Date.now();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days < 0) return "1d overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) return `due in ${days}d`;
  return `due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function Avatar({
  member,
  fallback,
}: {
  member:
    | {
        name: string | null;
        email: string;
        avatarUrl: string | null;
      }
    | null;
  fallback?: string | null;
}) {
  const display = member?.name ?? member?.email ?? fallback ?? "?";
  const initial = display.trim()[0]?.toUpperCase() ?? "?";
  const size = 28;
  if (member?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt={display}
        width={size}
        height={size}
        style={{ borderRadius: 999, objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "var(--ink)",
        color: "var(--bg)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {initial}
    </span>
  );
}

// ============== QUICK ACTIONS ==============

function QuickActions({ projectId }: { projectId: string }) {
  return (
    <section>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "16px 18px",
          background: "var(--paper)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          className="label"
          style={{ marginBottom: 4, color: "var(--mute)" }}
        >
          Quick actions
        </div>
        <Link
          href={`/projects/${projectId}/transcripts`}
          className="pill pill-red"
          style={{
            textDecoration: "none",
            justifyContent: "center",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ScrollText size={14} strokeWidth={2.2} />
          Upload transcript
        </Link>
        <Link
          href={`/projects/${projectId}/members`}
          className="pill pill-ghost"
          style={{
            textDecoration: "none",
            justifyContent: "center",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <UserPlus size={14} strokeWidth={2.2} />
          Invite member
        </Link>
        <AskGprTrigger />
        <Link
          href={`/projects/${projectId}/leaderboard`}
          className="lk-mute"
          style={{
            fontSize: 12,
            textAlign: "center",
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          Open leaderboard
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </section>
  );
}
