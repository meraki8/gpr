export function Score({
  value,
  size = 56,
  color,
}: {
  value: number | string;
  size?: number;
  color?: string;
}) {
  return (
    <span
      className="num display"
      style={{ fontSize: size, lineHeight: 0.9, color: color ?? "var(--ink)" }}
    >
      {value}
    </span>
  );
}
