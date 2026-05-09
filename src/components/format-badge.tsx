import { transcriptFormatPalette } from "@/lib/transcript-format";

type Props = {
  format: string | null | undefined;
  size?: "sm" | "md";
};

// Colored pill for a detected transcript format (DISCORD, SLACK,
// WHATSAPP, EMAIL, ZOOM, MEETING, OTHER). Uses a soft tint of the
// brand color so it reads as a badge, not a button.
export function FormatBadge({ format, size = "sm" }: Props) {
  if (!format) return null;
  const { color, label } = transcriptFormatPalette(format);
  const pad = size === "md" ? "3px 10px" : "2px 8px";
  const fontSize = size === "md" ? 11 : 10;
  return (
    <span
      className="num"
      style={{
        display: "inline-block",
        padding: pad,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
      title={`Detected format: ${label.toLowerCase()}`}
    >
      {label}
    </span>
  );
}
