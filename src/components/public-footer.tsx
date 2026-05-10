import { Wordmark } from "@/components/wordmark";

// Footer used on every public-facing page so the byline + tagline
// stay consistent. Three-column layout matching the original
// homepage design — wordmark, copyright, byline — flexed across
// the full width.
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        padding: "40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        color: "var(--mute)",
        fontSize: 12,
        borderTop: "1px solid var(--line)",
      }}
    >
      <Wordmark small />
      <div>© {year} GPR — Group Project Referee</div>
      <div>Built with meraki — Lincoln University, Christchurch NZ</div>
    </footer>
  );
}
