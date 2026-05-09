const STATUS_MAP: Record<string, { c: string; t: string }> = {
  delivering: { c: "var(--status-good)", t: "Delivering" },
  "on track": { c: "var(--ink)", t: "On track" },
  "falling behind": { c: "var(--status-watch)", t: "Falling behind" },
  "no contact": { c: "var(--red)", t: "No contact" },
  good: { c: "var(--status-good)", t: "Healthy" },
  watch: { c: "var(--status-watch)", t: "Watch" },
  risk: { c: "var(--red)", t: "At risk" },
  draft: { c: "var(--mute)", t: "Draft" },
  published: { c: "var(--status-good)", t: "Published" },
};

export function Status({ kind }: { kind: string }) {
  const s = STATUS_MAP[kind.toLowerCase()] || { c: "var(--mute)", t: kind };
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ fontSize: 13 }}
    >
      <span className="dot" style={{ background: s.c }} />
      {s.t}
    </span>
  );
}
