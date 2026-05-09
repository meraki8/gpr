"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { SerializedProgressReport } from "@/lib/progress-report";

const RED = "#DC2626";
const INK = "#0a0a0a";
const MUTE = "#666666";
const RULE = "#dddddd";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 18,
    height: 18,
    backgroundColor: RED,
    marginRight: 10,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: INK,
    letterSpacing: -0.4,
  },
  brandMuted: {
    color: MUTE,
    fontSize: 9,
    marginLeft: "auto",
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    color: INK,
    marginBottom: 6,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: MUTE,
    fontSize: 10,
    marginBottom: 18,
  },
  brief: {
    fontSize: 10,
    color: INK,
    marginBottom: 20,
    lineHeight: 1.55,
  },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    color: RED,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: INK,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: RULE,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  statBoxLast: {
    marginRight: 0,
  },
  statLabel: {
    color: MUTE,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: INK,
  },
  statValueRed: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: RED,
  },
  statSub: {
    color: MUTE,
    fontSize: 8,
    marginTop: 3,
  },
  breakdown: {
    borderWidth: 1,
    borderColor: RULE,
    padding: 12,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9.5,
  },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: MUTE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    fontSize: 10,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cellNum: {
    width: 22,
    color: MUTE,
  },
  cellName: {
    flex: 1.4,
  },
  cellRight: {
    textAlign: "right",
  },
  meetingTitleCell: {
    flex: 1.6,
  },
  meetingDateCell: {
    width: 80,
    color: MUTE,
  },
  meetingTopCell: {
    width: 130,
    textAlign: "right",
  },
  commitmentTitleCell: {
    flex: 1.6,
  },
  commitmentAssigneeCell: {
    width: 100,
    color: MUTE,
  },
  commitmentDateCell: {
    width: 70,
    textAlign: "right",
  },
  overdue: {
    color: RED,
    fontFamily: "Helvetica-Bold",
  },
  decisionItem: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
  },
  decisionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: INK,
    marginBottom: 3,
  },
  decisionContent: {
    color: MUTE,
    fontSize: 9.5,
    lineHeight: 1.5,
  },
  decisionDate: {
    color: MUTE,
    fontSize: 8,
    marginTop: 3,
  },
  pageNumber: {
    position: "absolute",
    fontSize: 8,
    bottom: 28,
    left: 0,
    right: 48,
    textAlign: "right",
    color: MUTE,
  },
  footer: {
    position: "absolute",
    fontSize: 8,
    bottom: 28,
    left: 48,
    color: MUTE,
  },
  emptyMuted: {
    fontSize: 10,
    color: MUTE,
    fontStyle: "italic",
  },
});

export function ProgressReportDocument({
  report,
}: {
  report: SerializedProgressReport;
}) {
  const generatedDate = new Date(report.generatedAtIso).toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  );
  const deadlineLabel = formatDeadline(
    report.project.deadlineIso,
    report.daysToDeadline,
  );
  const overdue =
    report.daysToDeadline !== null && report.daysToDeadline < 0;

  return (
    <Document
      title={`${report.project.name} — Progress Report`}
      author="GPR"
      subject="Progress Report"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Header / brand */}
        <View style={styles.header}>
          <View style={styles.logo} />
          <Text style={styles.brand}>GPR</Text>
          <Text style={styles.brandMuted}>
            Progress Report · {generatedDate}
          </Text>
        </View>

        {/* Project summary */}
        <Text style={styles.sectionLabel}>01 · Project summary</Text>
        <Text style={styles.title}>{report.project.name}</Text>
        <Text style={styles.subtitle}>{report.project.groupName}</Text>
        <Text style={styles.brief}>{report.project.brief}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Project health</Text>
            <Text style={styles.statValue}>{report.health.score}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Deadline</Text>
            <Text style={overdue ? styles.statValueRed : styles.statValue}>
              {deadlineLabel}
            </Text>
            {report.project.deadlineIso && (
              <Text style={styles.statSub}>
                {new Date(report.project.deadlineIso).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </Text>
            )}
          </View>
          <View style={[styles.statBox, styles.statBoxLast]}>
            <Text style={styles.statLabel}>Activity</Text>
            <Text style={styles.statValue}>
              {report.counts.meetings} meeting
              {report.counts.meetings === 1 ? "" : "s"}
            </Text>
            <Text style={styles.statSub}>
              {report.counts.cards} card
              {report.counts.cards === 1 ? "" : "s"} ·{" "}
              {report.counts.commitments} commitment
              {report.counts.commitments === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text>Base</Text>
            <Text>+{report.health.base}</Text>
          </View>
          {renderBreakdownDeduction(
            "Inactive members",
            report.health.deductions.inactiveMembers,
            report.health.inputs.inactiveCount,
          )}
          {renderBreakdownDeduction(
            "Red cards, last 2",
            report.health.deductions.redCardsLast2,
          )}
          {renderBreakdownDeduction(
            "Yellow cards, last 2",
            report.health.deductions.yellowCardsLast2,
          )}
          {renderBreakdownDeduction(
            "Overdue commitments",
            report.health.deductions.overdueCommitments,
            report.health.inputs.overdueCount,
          )}
          {renderBreakdownDeduction(
            "Project going dark",
            report.health.deductions.projectGoingDark,
          )}
          {renderBreakdownDeduction(
            "Ghost members",
            report.health.deductions.ghostMembers,
            report.health.inputs.ghostCount,
          )}
          {report.health.bonuses.mvpLastMeeting > 0 && (
            <View style={styles.breakdownRow}>
              <Text>MVP last meeting</Text>
              <Text>+{report.health.bonuses.mvpLastMeeting}</Text>
            </View>
          )}
        </View>

        {/* Team performance */}
        <Text style={styles.sectionLabel}>02 · Team performance</Text>
        <View style={styles.tableHead}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellName}>Member</Text>
          <Text style={[styles.cellRight, { width: 50 }]}>Score</Text>
          <Text style={[styles.cellRight, { width: 80 }]}>Cards</Text>
          <Text style={[styles.cellRight, { width: 65 }]}>Meetings</Text>
          <Text style={[styles.cellRight, { width: 65 }]}>
            {report.githubConnected ? "Commits" : ""}
          </Text>
        </View>
        {report.members.map((m, i) => (
          <View
            key={m.id}
            style={[
              styles.tableRow,
              i === report.members.length - 1 ? styles.tableRowLast : {},
            ]}
          >
            <Text style={styles.cellNum}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.cellName}>{m.name ?? m.email}</Text>
            <Text style={[styles.cellRight, { width: 50 }]}>
              {m.contributionScore}
            </Text>
            <Text style={[styles.cellRight, { width: 80 }]}>
              {formatCards(m.cards)}
            </Text>
            <Text style={[styles.cellRight, { width: 65 }]}>
              {m.meetingsCount}
            </Text>
            <Text style={[styles.cellRight, { width: 65 }]}>
              {report.githubConnected ? m.commitsCount : "—"}
            </Text>
          </View>
        ))}
        {report.members.length === 0 && (
          <Text style={styles.emptyMuted}>No members yet.</Text>
        )}

        {/* Meeting history */}
        <Text style={styles.sectionLabel}>03 · Meeting history</Text>
        {report.meetings.length === 0 ? (
          <Text style={styles.emptyMuted}>No meetings analysed yet.</Text>
        ) : (
          <>
            {report.meetings.map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.tableRow,
                  i === report.meetings.length - 1
                    ? styles.tableRowLast
                    : {},
                ]}
              >
                <Text style={styles.meetingDateCell}>
                  {new Date(m.iso).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.meetingTitleCell}>
                  {m.title ?? "Untitled meeting"}
                </Text>
                <Text style={styles.meetingTopCell}>
                  {m.topScorer
                    ? `${m.topScorer.name} · ${m.topScorer.score}`
                    : "—"}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Open commitments */}
        <Text style={styles.sectionLabel}>04 · Open commitments</Text>
        {report.commitments.length === 0 ? (
          <Text style={styles.emptyMuted}>No open commitments.</Text>
        ) : (
          <>
            {report.commitments.map((c, i) => (
              <View
                key={c.id}
                style={[
                  styles.tableRow,
                  i === report.commitments.length - 1
                    ? styles.tableRowLast
                    : {},
                ]}
              >
                <Text
                  style={[
                    styles.commitmentTitleCell,
                    c.overdue ? styles.overdue : {},
                  ]}
                >
                  {c.title}
                </Text>
                <Text style={styles.commitmentAssigneeCell}>
                  {c.assignedTo ?? "unassigned"}
                </Text>
                <Text
                  style={[
                    styles.commitmentDateCell,
                    c.overdue ? styles.overdue : {},
                  ]}
                >
                  {new Date(c.targetDateIso).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {c.overdue ? " · OVERDUE" : ""}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Key decisions */}
        <Text style={styles.sectionLabel}>05 · Key decisions</Text>
        {report.decisions.length === 0 ? (
          <Text style={styles.emptyMuted}>
            No decisions logged from transcripts yet.
          </Text>
        ) : (
          <>
            {report.decisions.map((d) => (
              <View key={d.id} style={styles.decisionItem} wrap={false}>
                <Text style={styles.decisionTitle}>{d.title}</Text>
                <Text style={styles.decisionContent}>
                  {truncate(d.content, 360)}
                </Text>
                <Text style={styles.decisionDate}>
                  {new Date(d.createdAtIso).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          Generated by GPR — Group Project Referee
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function renderBreakdownDeduction(
  label: string,
  value: number,
  count?: number,
) {
  if (value <= 0) return null;
  const labelText = count !== undefined ? `${label} (${count})` : label;
  return (
    <View style={styles.breakdownRow}>
      <Text>{labelText}</Text>
      <Text style={{ color: RED }}>−{value}</Text>
    </View>
  );
}

function formatCards(cards: { mvp: number; y: number; r: number }) {
  if (cards.mvp === 0 && cards.y === 0 && cards.r === 0) return "—";
  const parts: string[] = [];
  if (cards.mvp) parts.push(`${cards.mvp} MVP`);
  if (cards.y) parts.push(`${cards.y} Y`);
  if (cards.r) parts.push(`${cards.r} R`);
  return parts.join(" · ");
}

function formatDeadline(
  iso: string | null,
  days: number | null,
): string {
  if (!iso) return "No deadline";
  if (days === null) return "—";
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}
