export type RefCardKind = "y" | "r" | "mvp";

export function RefCard({
  kind,
  size = 36,
  rotate = 0,
}: {
  kind: RefCardKind;
  size?: number;
  rotate?: number;
}) {
  const w = Math.round(size * 0.72);
  const h = size;
  const isMvp = kind === "mvp";
  const bg =
    kind === "y" ? "#f5c518" : kind === "r" ? "var(--red)" : "var(--ink)";
  return (
    <span
      className="inline-block relative"
      style={{
        width: w,
        height: h,
        background: bg,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
        flexShrink: 0,
      }}
    >
      {isMvp && (
        <span
          className="absolute inset-0 flex items-center justify-center text-white"
          style={{ fontSize: w * 0.5, fontWeight: 600 }}
        >
          ★
        </span>
      )}
    </span>
  );
}

export function cardKindFromCardType(
  cardType: "YELLOW" | "RED" | "MVP",
): RefCardKind {
  return cardType === "YELLOW" ? "y" : cardType === "RED" ? "r" : "mvp";
}
