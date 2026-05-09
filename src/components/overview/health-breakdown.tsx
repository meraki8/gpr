"use client";

import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Breakdown = {
  score: number;
  base: number;
  deductions: {
    inactiveMembers: number;
    redCardsLast2: number;
    yellowCardsLast2: number;
    overdueCommitments: number;
    projectGoingDark: number;
    ghostMembers: number;
  };
  bonuses: { mvpLastMeeting: number };
  inputs: {
    totalMeetings: number;
    inactiveCount: number;
    ghostCount: number;
    overdueCount: number;
    redCount: number;
    yellowCount: number;
    daysSinceLastTranscript: number | null;
    projectAgeDays: number;
    mvpInLastMeeting: boolean;
  };
};

type Line = {
  key: string;
  label: string;
  detail?: string;
  delta: number; // signed; negative for deduction, positive for bonus
};

export function HealthBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const lines = buildLines(breakdown);

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Why this score?"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--mute)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Health score breakdown"
          style={{
            position: "absolute",
            zIndex: 30,
            marginTop: 8,
            top: "100%",
            right: 0,
            width: 320,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "0 16px 40px -16px rgba(0,0,0,0.45)",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
              }}
            >
              How we calculated{" "}
              <span className="num">{breakdown.score}</span>/100
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--mute)",
                cursor: "pointer",
                padding: 0,
                lineHeight: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <BreakdownRow
              label="Starting score"
              detail="Every project starts at 100"
              delta={breakdown.base}
              isBase
            />
            {lines.map((l) => (
              <BreakdownRow
                key={l.key}
                label={l.label}
                detail={l.detail}
                delta={l.delta}
              />
            ))}
            <BreakdownRow
              label="Final score"
              delta={breakdown.score}
              isFinal
            />
          </ul>

          {lines.length === 0 && (
            <div
              className="mute-ink"
              style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}
            >
              No deductions yet — the squad is keeping things clean.
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function buildLines(b: Breakdown): Line[] {
  const out: Line[] = [];
  if (b.deductions.inactiveMembers > 0) {
    out.push({
      key: "inactive",
      label: `${b.inputs.inactiveCount} inactive member${
        b.inputs.inactiveCount === 1 ? "" : "s"
      }`,
      detail: "Score 0 after 2+ meetings analysed",
      delta: -b.deductions.inactiveMembers,
    });
  }
  if (b.deductions.redCardsLast2 > 0) {
    out.push({
      key: "red",
      label: `${b.inputs.redCount} red card${
        b.inputs.redCount === 1 ? "" : "s"
      } in last 2 meetings`,
      delta: -b.deductions.redCardsLast2,
    });
  }
  if (b.deductions.yellowCardsLast2 > 0) {
    out.push({
      key: "yellow",
      label: `${b.inputs.yellowCount} yellow card${
        b.inputs.yellowCount === 1 ? "" : "s"
      } in last 2 meetings`,
      delta: -b.deductions.yellowCardsLast2,
    });
  }
  if (b.deductions.overdueCommitments > 0) {
    out.push({
      key: "overdue",
      label: `${b.inputs.overdueCount} overdue commitment${
        b.inputs.overdueCount === 1 ? "" : "s"
      }`,
      detail: "Target date passed in the KB",
      delta: -b.deductions.overdueCommitments,
    });
  }
  if (b.deductions.projectGoingDark > 0) {
    const days =
      b.inputs.daysSinceLastTranscript === null
        ? null
        : Math.floor(b.inputs.daysSinceLastTranscript);
    out.push({
      key: "dark",
      label: "Project going dark",
      detail:
        days === null
          ? "No transcript uploaded yet"
          : `No transcript in ${days} day${days === 1 ? "" : "s"}`,
      delta: -b.deductions.projectGoingDark,
    });
  }
  if (b.deductions.ghostMembers > 0) {
    out.push({
      key: "ghost",
      label: `${b.inputs.ghostCount} ghost member${
        b.inputs.ghostCount === 1 ? "" : "s"
      }`,
      detail: "Never appeared in any analysed meeting",
      delta: -b.deductions.ghostMembers,
    });
  }
  if (b.bonuses.mvpLastMeeting > 0) {
    out.push({
      key: "mvp",
      label: "MVP card issued in the last meeting",
      detail: "Team is performing",
      delta: b.bonuses.mvpLastMeeting,
    });
  }
  return out;
}

function BreakdownRow({
  label,
  detail,
  delta,
  isBase,
  isFinal,
}: {
  label: string;
  detail?: string;
  delta: number;
  isBase?: boolean;
  isFinal?: boolean;
}) {
  const isDeduction = !isBase && !isFinal && delta < 0;
  const isBonus = !isBase && !isFinal && delta > 0;
  const display = isBase || isFinal
    ? String(delta)
    : `${delta >= 0 ? "+" : ""}${delta}`;
  const color = isFinal
    ? "var(--ink)"
    : isDeduction
      ? "var(--red)"
      : isBonus
        ? "var(--status-good, #16a34a)"
        : "var(--ink-2, var(--ink))";
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 12,
        padding: "8px 0",
        alignItems: "baseline",
        borderTop: isFinal ? "1px solid var(--line)" : undefined,
        borderBottom: isBase ? "1px solid var(--line-2)" : undefined,
        marginTop: isFinal ? 6 : 0,
        paddingTop: isFinal ? 12 : 8,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isFinal ? 600 : 500,
            color: "var(--ink)",
          }}
        >
          {label}
        </div>
        {detail && (
          <div
            className="mute-ink"
            style={{ fontSize: 11, marginTop: 1, lineHeight: 1.4 }}
          >
            {detail}
          </div>
        )}
      </div>
      <span
        className="num"
        style={{
          fontSize: isFinal ? 16 : 13,
          fontWeight: isFinal ? 600 : 500,
          color,
          whiteSpace: "nowrap",
        }}
      >
        {display}
      </span>
    </li>
  );
}
