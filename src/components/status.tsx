const STATUS_MAP: Record<string, { c: string; t: string }> = {
  delivering: { c: "#1c8c4d", t: "Delivering" },
  "on track": { c: "#0a0a0a", t: "On track" },
  "falling behind": { c: "#c89014", t: "Falling behind" },
  "no contact": { c: "var(--red)", t: "No contact" },
  good: { c: "#1c8c4d", t: "Healthy" },
  watch: { c: "#c89014", t: "Watch" },
  risk: { c: "var(--red)", t: "At risk" },
  draft: { c: "var(--mute)", t: "Draft" },
  published: { c: "#1c8c4d", t: "Published" },
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
