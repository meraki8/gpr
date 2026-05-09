export function Trend({ value, size = 13 }: { value: number; size?: number }) {
  const up = value >= 0;
  const c = value === 0 ? "var(--mute)" : up ? "#1c8c4d" : "var(--red)";
  return (
    <span className="num" style={{ fontSize: size, color: c, fontWeight: 500 }}>
      {up ? "+" : ""}
      {value}
    </span>
  );
}
