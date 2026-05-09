import { AlertTriangle, GitCommit, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProgressReportActions } from "@/components/progress-report-actions";
import { RefCard } from "@/components/ref-card";
import { Score } from "@/components/score";
import { requireDbUser } from "@/lib/auth";
import { checkContractGate, getNavContext, getProgressReport } from "@/lib/data";
import { serializeProgressReport } from "@/lib/progress-report";

type Report = Awaited<ReturnType<typeof getProgressReport>>;

export default async function ProgressReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await checkContractGate(projectId);
  const [user, nav, report] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProgressReport(projectId),
  ]);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{
        id: report.project.id,
        name: report.project.name,
        deadlineIso: report.project.deadline?.toISOString() ?? null,
      }}
    >
      <main
        className="wrap-w fade-up printable"
        style={{ paddingTop: 32, paddingBottom: 160 }}
      >
        {/* Top bar — actions */}
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 14,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div className="label">Progress Report</div>
          <ProgressReportActions report={serializeProgressReport(report)} />
        </div>

        <ProjectSummary report={report} />
        <hr className="hr" style={{ margin: "48px 0" }} />

        <TeamPerformance report={report} />
        <hr className="hr" style={{ margin: "48px 0" }} />

        <MeetingHistory report={report} />
        <hr className="hr" style={{ margin: "48px 0" }} />

        <OpenCommitments report={report} />
        <hr className="hr" style={{ margin: "48px 0" }} />

        <KeyDecisions report={report} />
      </main>

      {/* Print stylesheet — hides chrome and forces a clean B/W layout
          when the user prints the page. */}
      <style>{`
        @media print {
          @page { margin: 18mm; }
          body { background: #fff !important; }
          aside, .no-print, [aria-label="Open Ask GPR"] {
            display: none !important;
          }
          .printable {
            padding: 0 !important;
            max-width: 100% !important;
            color: #000 !important;
          }
          .printable, .printable * {
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
          }
          .printable .print-accent {
            color: #DC2626 !important;
          }
          .printable .hr {
            border-color: #ddd !important;
          }
          .printable section {
            break-inside: avoid;
          }
          .printable h1, .printable h2, .printable h3, .printable .display {
            break-after: avoid;
          }
        }
      `}</style>
    </AppShell>
  );
}

// ============== SECTIONS ==============

function ProjectSummary({ report }: { report: Report }) {
  const { project, health, daysToDeadline } = report;
  const healthColor =
    health.score >= 80
      ? "var(--status-good, #16a34a)"
      : health.score >= 50
        ? "var(--status-watch, #d97706)"
        : "var(--red)";
  const deadlineLabel = (() => {
    if (!project.deadline) return "No deadline set";
    if (daysToDeadline === null) return "—";
    if (daysToDeadline < 0)
      return `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? "" : "s"} overdue`;
    if (daysToDeadline === 0) return "Due today";
    return `${daysToDeadline} day${daysToDeadline === 1 ? "" : "s"} remaining`;
  })();
  return (
    <section>
      <div
        className="label print-accent"
        style={{ marginBottom: 14, color: "var(--red)" }}
      >
        01 · Project summary
      </div>
      <h1
        className="display"
        style={{
          fontSize: "clamp(36px, 5vw, 56px)",
          margin: 0,
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
        }}
      >
        {project.name}
      </h1>
      <p
        className="body"
        style={{
          marginTop: 14,
          maxWidth: 760,
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--ink-2)",
        }}
      >
        {project.brief}
      </p>

      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <SummaryStat label="Project health">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Score value={health.score} size={48} color={healthColor} />
          </div>
        </SummaryStat>
        <SummaryStat label="Deadline">
          <div
            className="display num"
            style={{
              fontSize: 28,
              fontWeight: 500,
              color:
                daysToDeadline !== null && daysToDeadline < 0
                  ? "var(--red)"
                  : "var(--ink)",
            }}
          >
            {deadlineLabel}
          </div>
          {project.deadline && (
            <div
              className="mute-ink"
              style={{ fontSize: 12, marginTop: 4 }}
            >
              {project.deadline.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
        </SummaryStat>
        <SummaryStat label="Activity">
          <div
            className="display num"
            style={{ fontSize: 28, fontWeight: 500 }}
          >
            {report.counts.meetings} meeting
            {report.counts.meetings === 1 ? "" : "s"}
          </div>
          <div className="mute-ink" style={{ fontSize: 12, marginTop: 4 }}>
            {report.counts.cards} card
            {report.counts.cards === 1 ? "" : "s"} ·{" "}
            {report.counts.commitments} open commitment
            {report.counts.commitments === 1 ? "" : "s"}
          </div>
        </SummaryStat>
      </div>

      <div
        style={{
          marginTop: 28,
          padding: "18px 20px",
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "var(--paper)",
        }}
      >
        <div className="label" style={{ marginBottom: 12 }}>
          Health breakdown
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px 24px",
            fontSize: 13,
          }}
        >
          <BreakdownRow
            label="Base"
            value={health.base}
            sign="+"
            color="var(--ink)"
          />
          {health.deductions.inactiveMembers > 0 && (
            <BreakdownRow
              label={`Inactive members (${health.inputs.inactiveCount})`}
              value={health.deductions.inactiveMembers}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.deductions.redCardsLast2 > 0 && (
            <BreakdownRow
              label={`Red cards, last 2 meetings`}
              value={health.deductions.redCardsLast2}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.deductions.yellowCardsLast2 > 0 && (
            <BreakdownRow
              label={`Yellow cards, last 2 meetings`}
              value={health.deductions.yellowCardsLast2}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.deductions.overdueCommitments > 0 && (
            <BreakdownRow
              label={`Overdue commitments (${health.inputs.overdueCount})`}
              value={health.deductions.overdueCommitments}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.deductions.projectGoingDark > 0 && (
            <BreakdownRow
              label={`No transcript in ${health.inputs.daysSinceLastTranscript}d`}
              value={health.deductions.projectGoingDark}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.deductions.ghostMembers > 0 && (
            <BreakdownRow
              label={`Ghost members (${health.inputs.ghostCount})`}
              value={health.deductions.ghostMembers}
              sign="−"
              color="var(--red)"
            />
          )}
          {health.bonuses.mvpLastMeeting > 0 && (
            <BreakdownRow
              label="MVP last meeting"
              value={health.bonuses.mvpLastMeeting}
              sign="+"
              color="var(--status-good, #16a34a)"
            />
          )}
        </ul>
      </div>
    </section>
  );
}

function TeamPerformance({ report }: { report: Report }) {
  return (
    <section>
      <div
        className="label print-accent"
        style={{ marginBottom: 18, color: "var(--red)" }}
      >
        02 · Team performance
      </div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "32px minmax(0, 1.2fr) 70px 110px 80px 90px",
            gap: 14,
            padding: "14px 18px",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--mute)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>#</span>
          <span>Member</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "right" }}>Cards</span>
          <span style={{ textAlign: "right" }}>Meetings</span>
          <span style={{ textAlign: "right" }}>
            {report.githubConnected ? "Commits" : "—"}
          </span>
        </div>
        {report.members.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "32px minmax(0, 1.2fr) 70px 110px 80px 90px",
              gap: 14,
              padding: "14px 18px",
              alignItems: "center",
              borderBottom:
                i === report.members.length - 1
                  ? undefined
                  : "1px solid var(--line-2)",
              fontSize: 14,
            }}
          >
            <span
              className="num display mute-ink"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.name ?? m.email}
              </div>
              <div className="mute-ink" style={{ fontSize: 11 }}>
                {m.role.toLowerCase()}
              </div>
            </div>
            <span
              className="num display"
              style={{
                fontSize: 18,
                fontWeight: 500,
                textAlign: "right",
                color:
                  m.contributionScore > 0 ? "var(--ink)" : "var(--mute-2)",
              }}
            >
              {m.contributionScore}
            </span>
            <span
              style={{
                display: "inline-flex",
                gap: 3,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {m.cards.mvp === 0 &&
              m.cards.y === 0 &&
              m.cards.r === 0 ? (
                <span className="mute-ink num" style={{ fontSize: 12 }}>
                  —
                </span>
              ) : (
                <>
                  {Array.from({ length: Math.min(m.cards.mvp, 3) }).map(
                    (_, k) => (
                      <RefCard key={`m${k}`} kind="mvp" size={12} />
                    ),
                  )}
                  {Array.from({ length: Math.min(m.cards.y, 3) }).map(
                    (_, k) => (
                      <RefCard key={`y${k}`} kind="y" size={12} />
                    ),
                  )}
                  {Array.from({ length: Math.min(m.cards.r, 3) }).map(
                    (_, k) => (
                      <RefCard key={`r${k}`} kind="r" size={12} />
                    ),
                  )}
                </>
              )}
            </span>
            <span
              className="num"
              style={{
                fontSize: 14,
                textAlign: "right",
                color:
                  m.meetingsCount > 0 ? "var(--ink)" : "var(--mute-2)",
              }}
            >
              {m.meetingsCount}
            </span>
            <span
              className="num"
              style={{
                fontSize: 14,
                textAlign: "right",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 5,
                color: m.commitsCount > 0 ? "var(--ink)" : "var(--mute-2)",
              }}
            >
              {report.githubConnected ? (
                <>
                  <GitCommit size={12} strokeWidth={2.2} />
                  {m.commitsCount}
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        ))}
        {report.members.length === 0 && (
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

function MeetingHistory({ report }: { report: Report }) {
  return (
    <section>
      <div
        className="label print-accent"
        style={{ marginBottom: 18, color: "var(--red)" }}
      >
        03 · Meeting history
      </div>
      {report.meetings.length === 0 ? (
        <p className="mute-ink body" style={{ margin: 0 }}>
          No meetings analysed yet.
        </p>
      ) : (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--paper)",
            overflow: "hidden",
          }}
        >
          {report.meetings.map((m, i) => {
            const date = m.meetingAt ?? m.createdAt;
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(0, 1fr) auto",
                  gap: 18,
                  padding: "14px 18px",
                  alignItems: "center",
                  borderBottom:
                    i === report.meetings.length - 1
                      ? undefined
                      : "1px solid var(--line-2)",
                  fontSize: 14,
                }}
              >
                <span className="num mute-ink" style={{ fontSize: 12 }}>
                  {date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.title ?? "Untitled meeting"}
                  </div>
                </div>
                {m.topScorer ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                    title={`Top scorer: ${m.topScorer.name}`}
                  >
                    <Trophy size={13} strokeWidth={2.2} />
                    <span>{m.topScorer.name}</span>
                    <span
                      className="num mute-ink"
                      style={{ marginLeft: 4 }}
                    >
                      {m.topScorer.score}
                    </span>
                  </span>
                ) : (
                  <span className="mute-ink" style={{ fontSize: 12 }}>
                    no scorers
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OpenCommitments({ report }: { report: Report }) {
  return (
    <section>
      <div
        className="label print-accent"
        style={{ marginBottom: 18, color: "var(--red)" }}
      >
        04 · Open commitments
      </div>
      {report.commitments.length === 0 ? (
        <p className="mute-ink body" style={{ margin: 0 }}>
          No open commitments.
        </p>
      ) : (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--paper)",
            overflow: "hidden",
          }}
        >
          {report.commitments.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 160px 110px",
                gap: 18,
                padding: "14px 18px",
                alignItems: "center",
                borderBottom:
                  i === report.commitments.length - 1
                    ? undefined
                    : "1px solid var(--line-2)",
                fontSize: 14,
                color: c.overdue ? "var(--red)" : undefined,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {c.title}
                </div>
              </div>
              <div className="mute-ink" style={{ fontSize: 13 }}>
                {c.assignedTo ?? "unassigned"}
              </div>
              <div
                className="num"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "right",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  justifyContent: "flex-end",
                  color: c.overdue ? "var(--red)" : "var(--mute)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.overdue && (
                  <AlertTriangle size={13} strokeWidth={2.4} />
                )}
                {c.targetDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function KeyDecisions({ report }: { report: Report }) {
  return (
    <section>
      <div
        className="label print-accent"
        style={{ marginBottom: 18, color: "var(--red)" }}
      >
        05 · Key decisions
      </div>
      {report.decisions.length === 0 ? (
        <p className="mute-ink body" style={{ margin: 0 }}>
          No decisions logged from transcripts yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {report.decisions.map((d, i) => (
            <li
              key={d.id}
              style={{
                display: "grid",
                gridTemplateColumns: "32px minmax(0, 1fr) 110px",
                gap: 14,
                padding: "14px 0",
                alignItems: "baseline",
                borderBottom:
                  i === report.decisions.length - 1
                    ? undefined
                    : "1px solid var(--line-2)",
              }}
            >
              <span
                className="num display mute-ink"
                style={{ fontSize: 14, fontWeight: 500 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  {d.title}
                </div>
                <p
                  className="mute-ink"
                  style={{
                    fontSize: 13,
                    margin: "4px 0 0",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {d.content}
                </p>
              </div>
              <span
                className="num mute-ink"
                style={{ fontSize: 12, textAlign: "right" }}
              >
                {d.createdAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============== HELPERS ==============

function SummaryStat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "16px 18px",
        background: "var(--paper)",
      }}
    >
      <div className="label" style={{ marginBottom: 10, color: "var(--mute)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  sign,
  color,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  color: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 0",
      }}
    >
      <span style={{ color: "var(--ink-2)" }}>{label}</span>
      <span className="num" style={{ color, fontWeight: 600 }}>
        {sign}
        {value}
      </span>
    </li>
  );
}

