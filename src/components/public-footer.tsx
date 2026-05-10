import { Wordmark } from "@/components/wordmark";

// Footer used on every public-facing page so the byline + tagline
// stay consistent. Plain component (no client/server distinction).
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        padding: "32px 40px 40px",
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        color: "var(--mute)",
        fontSize: 13,
        borderTop: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Wordmark small />
      </div>
      <div
        style={{
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxWidth: 480,
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: "var(--ink-2, var(--ink))", fontWeight: 500 }}>
          © {year} GPR — Group Project Referee
        </span>
        <span>
          Built with meraki · Lincoln University, Christchurch New Zealand
        </span>
        <span style={{ fontStyle: "italic", color: "var(--mute)" }}>
          Every project needs a ref.
        </span>
      </div>
    </footer>
  );
}
