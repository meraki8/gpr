import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Score } from "@/components/score";
import { RefCard, cardKindFromCardType } from "@/components/ref-card";
import { requireDbUser } from "@/lib/auth";
import { getMatchReport, getNavContext } from "@/lib/data";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const [user, nav, report] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getMatchReport(reportId),
  ]);

  const memberReports = report.memberReports;
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
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{
        id: report.project.id,
        name: report.project.name,
        deadlineIso: report.project.deadline?.toISOString() ?? null,
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        {/* Hero */}
        <section style={{ padding: "80px 0 100px" }}>
          <div
            className="label fade-up"
            style={{ marginBottom: 32 }}
          >
            {headerLabel}
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

        <section style={{ padding: "100px 0 0" }}>
          <div className="label" style={{ marginBottom: 32 }}>
            Cards
          </div>
          {report.cards.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              No cards issued for this meeting.
            </p>
          ) : (
            report.cards.map((card) => {
              const flag = cardKindFromCardType(card.cardType);
              return (
                <div
                  key={card.id}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
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
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 500 }}>
                        {card.user.name ?? card.user.email}
                      </span>
                    </div>
                    <p
                      className="body"
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: "var(--ink-2)",
                      }}
                    >
                      {card.reason}
                    </p>
                  </div>
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
