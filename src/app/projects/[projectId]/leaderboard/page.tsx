import {
  GitCommit,
  GitPullRequest,
  Medal,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimatedNumber } from "@/components/animated-number";
import { PageHead } from "@/components/page-head";
import { RefCard } from "@/components/ref-card";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectLeaderboard } from "@/lib/data";

const MEDAL_COLOR: Record<number, string> = {
  1: "#d4a017", // gold
  2: "#a8a8a8", // silver
  3: "#b8732e", // bronze
};

type Member = Awaited<
  ReturnType<typeof getProjectLeaderboard>
>["members"][number];

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, board] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectLeaderboard(projectId),
  ]);

  const top3 = board.members.slice(0, 3);
  const rest = board.members.slice(3);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{ id: board.project.id, name: board.project.name }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Leaderboard · ${board.project.name}`}
          title="Who's carrying the squad."
          sub="Cumulative score from meetings, cards, and GitHub. The ref keeps tabs."
        />

        {/* Top stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            marginBottom: 56,
          }}
        >
          <StatTile
            label="Project health"
            value={board.totals.healthScore}
            sub="Avg score across squad"
          />
          <StatTile
            label="Meetings analysed"
            value={board.totals.totalMeetings}
            sub={
              board.totals.totalMeetings === 0
                ? "Run your first analysis"
                : "All-time"
            }
          />
          <StatTile
            label="Most improved · 7d"
            valueText={
              board.totals.mostImproved
                ? (board.totals.mostImproved.user.name ??
                  board.totals.mostImproved.user.email.split("@")[0])
                : "—"
            }
            sub={
              board.totals.mostImproved
                ? `+${board.totals.mostImproved.weekDelta} pts this week`
                : "Need a week of history"
            }
          />
        </section>

        {/* Podium */}
        {top3.length > 0 && (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: top3.length === 3
                ? "1fr 1.4fr 1fr"
                : top3.length === 2
                  ? "1fr 1fr"
                  : "1fr",
              gap: 18,
              alignItems: "end",
              marginBottom: 56,
            }}
          >
            {top3.length >= 2 && (
              <PodiumCard member={top3[1]} prominence="silver" />
            )}
            <PodiumCard member={top3[0]} prominence="gold" />
            {top3.length >= 3 && (
              <PodiumCard member={top3[2]} prominence="bronze" />
            )}
          </section>
        )}

        {/* Standard rows */}
        {rest.length > 0 && (
          <section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "70px minmax(0, 1fr) 110px 110px 130px 90px",
                gap: 24,
                padding: "16px 0 8px",
                color: "var(--mute)",
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>Rank</span>
              <span>Member</span>
              <span style={{ textAlign: "right" }}>Score</span>
              <span style={{ textAlign: "right" }}>Trend</span>
              <span>Cards</span>
              <span style={{ textAlign: "right" }}>GitHub</span>
            </div>
            {rest.map((m, i) => (
              <StandardRow
                key={m.id}
                member={m}
                animationDelay={i * 60}
              />
            ))}
          </section>
        )}

        {board.members.length === 0 && (
          <p
            className="body mute-ink"
            style={{ marginTop: 60, textAlign: "center" }}
          >
            No members yet. Invite the squad.
          </p>
        )}
      </main>
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  valueText,
  sub,
}: {
  label: string;
  value?: number;
  valueText?: string;
  sub?: string;
}) {
  return (
    <div
      className="fade-up"
      style={{
        padding: "20px 22px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--paper)",
      }}
    >
      <div className="label" style={{ marginBottom: 14 }}>
        {label}
      </div>
      <div
        className="display num"
        style={{
          fontSize: 44,
          lineHeight: 1,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {valueText ?? <AnimatedNumber value={value ?? 0} />}
      </div>
      {sub && (
        <div
          className="mute-ink"
          style={{ fontSize: 12, marginTop: 10 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  member,
  prominence,
}: {
  member: Member;
  prominence: "gold" | "silver" | "bronze";
}) {
  const isGold = prominence === "gold";
  const medalColor = MEDAL_COLOR[member.rank] ?? "var(--mute)";
  const cardHeight = isGold ? 320 : 260;
  const scoreSize = isGold ? 92 : 64;
  const animationDelay = isGold ? "60ms" : "0ms";

  return (
    <div
      className="fade-up"
      style={{
        position: "relative",
        height: cardHeight,
        padding: "24px 22px",
        background:
          prominence === "gold"
            ? `linear-gradient(180deg, var(--paper) 0%, color-mix(in srgb, ${medalColor} 8%, var(--paper)) 100%)`
            : "var(--paper)",
        border: `1px solid ${isGold ? medalColor : "var(--line)"}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animationDelay,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="num display"
          style={{
            fontSize: isGold ? 56 : 40,
            lineHeight: 0.9,
            fontWeight: 500,
            color: medalColor,
            letterSpacing: "-0.04em",
          }}
        >
          #{member.rank}
        </span>
        <Medal size={isGold ? 30 : 22} color={medalColor} />
      </div>

      <div style={{ marginTop: 4 }}>
        <Avatar member={member} size={isGold ? 56 : 44} medalColor={medalColor} />
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          className="h-s"
          style={{
            fontSize: isGold ? 22 : 18,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--ink)",
          }}
          title={member.user.name ?? member.user.email}
        >
          {member.user.name ?? member.user.email}
        </div>
        <div
          className="mute-ink"
          style={{ fontSize: 12, textTransform: "lowercase" }}
        >
          {member.role}
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div
          className="num display"
          style={{
            fontSize: scoreSize,
            lineHeight: 0.9,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.03em",
          }}
        >
          <AnimatedNumber value={member.contributionScore} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <TrendChip trend={member.trend} />
          <CardChips counts={member.cardCounts} />
          <GithubChip github={member.github} />
        </div>
      </div>
    </div>
  );
}

function StandardRow({
  member,
  animationDelay,
}: {
  member: Member;
  animationDelay: number;
}) {
  return (
    <div
      className="row-hover fade-up"
      style={{
        display: "grid",
        gridTemplateColumns:
          "70px minmax(0, 1fr) 110px 110px 130px 90px",
        gap: 24,
        padding: "20px 0",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <span
        className="num display"
        style={{
          fontSize: 28,
          color: "var(--mute-2)",
          letterSpacing: "-0.02em",
        }}
      >
        #{member.rank}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
        }}
      >
        <Avatar member={member} size={32} medalColor={null} />
        <div style={{ minWidth: 0 }}>
          <div
            className="h-s"
            style={{
              fontSize: 15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--ink)",
            }}
            title={member.user.name ?? member.user.email}
          >
            {member.user.name ?? member.user.email}
          </div>
          <div
            className="mute-ink"
            style={{ fontSize: 12, textTransform: "lowercase" }}
          >
            {member.role}
          </div>
        </div>
      </div>
      <div
        className="num display"
        style={{
          textAlign: "right",
          fontSize: 28,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        <AnimatedNumber value={member.contributionScore} />
      </div>
      <div
        style={{ display: "flex", justifyContent: "flex-end" }}
      >
        <TrendChip trend={member.trend} />
      </div>
      <CardChips counts={member.cardCounts} />
      <GithubChip github={member.github} alignRight />
    </div>
  );
}

function Avatar({
  member,
  size,
  medalColor,
}: {
  member: Member;
  size: number;
  medalColor: string | null;
}) {
  const initial =
    (member.user.name?.[0] ?? member.user.email[0] ?? "?").toUpperCase();
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
        width: size,
        height: size,
      }}
    >
      {member.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.user.avatarUrl}
          alt={member.user.name ?? member.user.email}
          width={size}
          height={size}
          style={{
            borderRadius: 999,
            objectFit: "cover",
          }}
        />
      ) : (
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
            fontSize: Math.round(size * 0.4),
            fontWeight: 600,
          }}
        >
          {initial}
        </span>
      )}
      {medalColor && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: Math.max(20, Math.round(size * 0.42)),
            height: Math.max(20, Math.round(size * 0.42)),
            borderRadius: 999,
            background: medalColor,
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--paper)",
          }}
        >
          <Trophy size={Math.round(size * 0.22)} />
        </span>
      )}
    </span>
  );
}

function TrendChip({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <span
        title="No change vs last meeting"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--mute)",
        }}
      >
        <Minus size={12} />
        <span className="num">0</span>
      </span>
    );
  }
  const positive = trend > 0;
  const color = positive ? "var(--status-good)" : "var(--red)";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      title={`${positive ? "+" : ""}${trend} vs last meeting`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color,
        fontWeight: 500,
      }}
    >
      <Icon size={12} />
      <span className="num">
        {positive ? "+" : ""}
        {trend}
      </span>
    </span>
  );
}

function CardChips({
  counts,
}: {
  counts: { MVP: number; YELLOW: number; RED: number };
}) {
  const items: Array<{
    key: "MVP" | "YELLOW" | "RED";
    color: string;
    kind: "mvp" | "y" | "r";
  }> = [
    { key: "MVP", color: "var(--status-good)", kind: "mvp" },
    { key: "YELLOW", color: "var(--status-watch)", kind: "y" },
    { key: "RED", color: "var(--red)", kind: "r" },
  ];
  const visible = items.filter((i) => counts[i.key] > 0);
  if (visible.length === 0) {
    return (
      <span className="mute-ink" style={{ fontSize: 12 }}>
        —
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {visible.map((i) => (
        <span
          key={i.key}
          title={`${counts[i.key]} ${i.key.toLowerCase()}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RefCard kind={i.kind} size={14} />
          <span className="num" style={{ fontSize: 12, color: i.color }}>
            {counts[i.key]}
          </span>
        </span>
      ))}
    </span>
  );
}

function GithubChip({
  github,
  alignRight,
}: {
  github: { commits: number; prs: number };
  alignRight?: boolean;
}) {
  if (github.commits === 0 && github.prs === 0) {
    return (
      <span
        className="mute-ink"
        style={{
          fontSize: 12,
          textAlign: alignRight ? "right" : undefined,
          display: "block",
        }}
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 10,
        alignItems: "center",
        justifyContent: alignRight ? "flex-end" : "flex-start",
      }}
    >
      {github.commits > 0 && (
        <span
          title={`${github.commits} commit${github.commits === 1 ? "" : "s"}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--ink-2)",
          }}
        >
          <GitCommit size={12} />
          <span className="num">{github.commits}</span>
        </span>
      )}
      {github.prs > 0 && (
        <span
          title={`${github.prs} pull request${github.prs === 1 ? "" : "s"}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--ink-2)",
          }}
        >
          <GitPullRequest size={12} />
          <span className="num">{github.prs}</span>
        </span>
      )}
    </span>
  );
}
