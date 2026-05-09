import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Score } from "@/components/score";
import { RefCard, cardKindFromCardType } from "@/components/ref-card";
import { requireDbUser } from "@/lib/auth";
import { getMatchReport, getMyGroups } from "@/lib/data";
import { approveCard, dismissCard, publishReport } from "./actions";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const [user, allGroups, report] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
    getMatchReport(reportId),
  ]);

  const memberReports = report.memberReports;
  const draftCardCount = report.cards.filter(
    (c) => c.status === "DRAFT",
  ).length;
  const visibleCardCount = report.cards.length;
  const teamScore = memberReports.length
    ? Math.round(
        memberReports.reduce((s, m) => s + m.contributionScore, 0) /
          memberReports.length,
      )
    : 0;
  const top = memberReports[0];

  const headerLabel = `Match report · ${report.project.name} · ${report.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  const titleDate = report.createdAt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell
      user={user}
      groups={allGroups}
      currentProject={{
        id: report.project.id,
        name: report.project.name,
        group: {
          id: report.project.group.id,
          name: report.project.group.name,
        },
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        {/* Hero */}
        <section style={{ padding: "80px 0 100px" }}>
          <div
            className="label fade-up"
            style={{ marginBottom: 32, display: "flex", gap: 14 }}
          >
            <span>{headerLabel}</span>
            <span
              style={{
                color:
                  report.status === "PUBLISHED" ? "var(--ink)" : "var(--mute)",
              }}
            >
              · {report.status}
            </span>
          </div>
          <h1
            className="display fade-up"
            style={{
              fontSize: "clamp(56px, 9vw, 124px)",
              margin: 0,
              fontWeight: 500,
              lineHeight: 0.92,
            }}
          >
            {titleDate}.
          </h1>

          <div
            className="fade-up"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 56,
              marginTop: 80,
              animationDelay: "100ms",
            }}
          >
            <BigStat label="Team health" value={teamScore} />
            <BigStat
              label="Cards issued"
              value={visibleCardCount}
              sub={
                visibleCardCount === 0
                  ? "Clean week."
                  : describeCards(report.cards)
              }
              color={visibleCardCount > 0 ? "var(--red)" : undefined}
            />
            <BigStat
              label="Top contributor"
              value={top?.user.name?.split(" ")[0] ?? "—"}
              sub={top ? `Score ${top.contributionScore}` : undefined}
              isText
            />
          </div>

          {report.isOwner && report.status === "DRAFT" && (
            <div
              style={{
                marginTop: 56,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <form action={publishReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button type="submit" className="pill pill-red">
                  Publish to team →
                </button>
              </form>
              <span
                className="mute-ink"
                style={{ fontSize: 13 }}
              >
                {draftCardCount > 0
                  ? `${draftCardCount} draft card${draftCardCount === 1 ? "" : "s"} pending — approve or dismiss below first.`
                  : "Team will see this report when published."}
              </span>
            </div>
          )}
        </section>

        <hr className="hr" />

        {/* The ref's note */}
        <section style={{ padding: "100px 0" }}>
          <div className="label" style={{ marginBottom: 32 }}>
            The ref&rsquo;s note
          </div>
          <p
            className="display"
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              margin: 0,
              fontWeight: 400,
              lineHeight: 1.2,
              maxWidth: 1080,
            }}
          >
            {report.summary}
          </p>
        </section>

        <hr className="hr" />

        {/* Per member */}
        <section style={{ padding: "100px 0 60px" }}>
          <div className="label" style={{ marginBottom: 56 }}>
            Per member
          </div>
          {memberReports.map((mr, i) => {
            const memberCards = report.cards.filter(
              (c) => c.userId === mr.userId,
            );
            const dominant = memberCards[0]?.cardType;
            const flag = dominant ? cardKindFromCardType(dominant) : null;
            return (
              <div
                key={mr.id}
                className="fade-up row-hover"
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 100px 110px 60px",
                  gap: 32,
                  padding: "28px 0",
                  borderBottom: "1px solid var(--line)",
                  alignItems: "center",
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <span
                  className="num display mute-ink"
                  style={{
                    fontSize: 30,
                    color:
                      i === 0
                        ? "var(--ink)"
                        : i === memberReports.length - 1 && memberReports.length > 1
                          ? "var(--red)"
                          : "var(--mute-2)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="h-s" style={{ marginBottom: 4 }}>
                    {mr.user.name ?? mr.user.email}
                  </div>
                  <div className="mute-ink" style={{ fontSize: 13 }}>
                    {mr.notes ?? "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Score
                    value={mr.contributionScore}
                    size={36}
                    color={
                      flag === "r"
                        ? "var(--red)"
                        : "var(--ink)"
                    }
                  />
                </div>
                <div
                  className="num mute-ink"
                  style={{ textAlign: "right", fontSize: 14 }}
                >
                  {mr.speakingTimePct !== null
                    ? `${mr.speakingTimePct.toFixed(0)}% talk`
                    : "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {flag ? (
                    <RefCard
                      kind={flag}
                      size={28}
                      rotate={
                        flag === "r" ? 4 : flag === "y" ? -4 : 0
                      }
                    />
                  ) : (
                    <span className="mute-ink">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* What was extracted (commitments) */}
        {memberReports.some(
          (mr) =>
            Array.isArray(mr.commitmentsJson) &&
            mr.commitmentsJson.length > 0,
        ) && (
          <section style={{ padding: "80px 0 0" }}>
            <div className="label" style={{ marginBottom: 56 }}>
              What was extracted
            </div>
            <div>
              {memberReports.flatMap((mr) => {
                const commitments = (mr.commitmentsJson as Array<{
                  text: string;
                  due_date_iso: string | null;
                  source_quote: string;
                }>) || [];
                return commitments.map((c, ci) => ({
                  ...c,
                  who: mr.user.name ?? mr.user.email,
                  key: `${mr.id}-${ci}`,
                }));
              }).map((f, i) => (
                <div
                  key={f.key}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 200px 1fr",
                    gap: 32,
                    padding: "20px 0",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "baseline",
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <span
                    className="num mute-ink"
                    style={{ fontSize: 13 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{ fontSize: 15, fontWeight: 500 }}
                  >
                    {f.who}
                  </span>
                  <div>
                    <div
                      className="body"
                      style={{ fontSize: 15, color: "var(--ink-2)" }}
                    >
                      {f.text}
                      {f.due_date_iso && (
                        <span
                          className="mute-ink num"
                          style={{ fontSize: 12, marginLeft: 10 }}
                        >
                          due{" "}
                          {new Date(f.due_date_iso).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      )}
                    </div>
                    <div
                      className="mute-ink"
                      style={{
                        fontSize: 13,
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      &ldquo;{f.source_quote}&rdquo;
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cards (with approve/dismiss for owners) */}
        <section style={{ padding: "100px 0 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 32,
            }}
          >
            <div className="label">
              Cards
              {report.isOwner && draftCardCount > 0 && (
                <span
                  style={{ color: "var(--red)", marginLeft: 12 }}
                >
                  · {draftCardCount} pending review
                </span>
              )}
            </div>
          </div>
          {report.cards.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              {report.isOwner
                ? "No cards drafted for this meeting."
                : "No approved cards for this meeting."}
            </p>
          ) : (
            report.cards.map((card) => {
              const flag = cardKindFromCardType(card.cardType);
              const showActions =
                report.isOwner && card.status === "DRAFT";
              return (
                <div
                  key={card.id}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto",
                    gap: 32,
                    padding: "24px 0",
                    borderBottom: "1px solid var(--line)",
                    alignItems: "center",
                  }}
                >
                  <RefCard
                    kind={flag}
                    size={42}
                    rotate={flag === "r" ? 4 : flag === "y" ? -4 : 0}
                  />
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 500 }}>
                        {card.user.name ?? card.user.email}
                      </span>
                      <span
                        className="label"
                        style={{
                          color:
                            card.status === "APPROVED"
                              ? "#1c8c4d"
                              : card.status === "DISMISSED"
                                ? "var(--mute-2)"
                                : "var(--mute)",
                        }}
                      >
                        {card.status}
                      </span>
                    </div>
                    <p
                      className="body"
                      style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}
                    >
                      {card.reason}
                    </p>
                  </div>
                  {showActions ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <form action={approveCard}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <button
                          type="submit"
                          className="pill pill-sm"
                          style={{ background: "#1c8c4d" }}
                        >
                          Approve
                        </button>
                      </form>
                      <form action={dismissCard}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <button
                          type="submit"
                          className="pill pill-ghost pill-sm"
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span style={{ width: 1 }} />
                  )}
                </div>
              );
            })
          )}
        </section>

        <section
          style={{
            padding: "100px 0 0",
            display: "flex",
            gap: 14,
          }}
        >
          <Link
            href={`/projects/${projectId}`}
            className="pill"
            style={{ textDecoration: "none" }}
          >
            ← Back to project
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

function describeCards(cards: { cardType: string }[]): string {
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.cardType] = (counts[c.cardType] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.YELLOW) parts.push(`${counts.YELLOW} yellow`);
  if (counts.RED) parts.push(`${counts.RED} red`);
  if (counts.MVP) parts.push(`${counts.MVP} MVP`);
  return parts.join(" · ") || "—";
}

function BigStat({
  label,
  value,
  sub,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 16 }}>
        {label}
      </div>
      {isText ? (
        <div
          className="display"
          style={{
            fontSize: 64,
            lineHeight: 0.9,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </div>
      ) : (
        <Score value={value} size={88} color={color} />
      )}
      {sub && (
        <div className="mute-ink" style={{ fontSize: 14, marginTop: 10 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
