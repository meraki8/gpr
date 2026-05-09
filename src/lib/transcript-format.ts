// Auto-detected transcript formats. Stored as a free-form string on
// Transcript.sourceFormat so we can add new platforms without a
// migration; the constants here keep callers honest.
export const TRANSCRIPT_FORMAT = {
  DISCORD: "discord",
  SLACK: "slack",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  ZOOM: "zoom",
  MEETING: "meeting",
  OTHER: "other",
} as const;

export type TranscriptFormat =
  (typeof TRANSCRIPT_FORMAT)[keyof typeof TRANSCRIPT_FORMAT];

// Heuristic detector. Order matters — the most distinctive patterns
// run first so a generic meeting transcript can't get mis-tagged as
// Slack just because it happens to contain a "9:30 AM\nSomeone"
// substring. Falls back to "other" when nothing matches.
export function detectTranscriptFormat(text: string): TranscriptFormat {
  if (!text) return TRANSCRIPT_FORMAT.OTHER;

  // Discord — bracketed AM/PM stamps next to a real channel hashtag
  // (#general is the canonical default), or Discord's "Today at hh:mm
  // AM/PM" relative timestamp.
  if (
    /\[\d{1,2}:\d{2} [AP]M\]/.test(text) &&
    text.includes("#general")
  ) {
    return TRANSCRIPT_FORMAT.DISCORD;
  }
  if (/Today at \d{1,2}:\d{2} [AP]M/.test(text)) {
    return TRANSCRIPT_FORMAT.DISCORD;
  }

  // WhatsApp — the literal export format, e.g. "12/04/2025, 9:30 am - "
  if (
    /\d{1,2}\/\d{1,2}\/\d{4},\s\d{1,2}:\d{2}\s[ap]m\s-\s/.test(text)
  ) {
    return TRANSCRIPT_FORMAT.WHATSAPP;
  }

  // Email thread — From / To / Subject headers all present.
  if (
    text.includes("From:") &&
    text.includes("Subject:") &&
    text.includes("To:")
  ) {
    return TRANSCRIPT_FORMAT.EMAIL;
  }

  // Zoom / Teams auto-transcript — WEBVTT header, or Zoom's
  // "Transcription by Zoom" footer specifically.
  if (
    text.includes("WEBVTT") ||
    text.includes("Transcription by Zoom")
  ) {
    return TRANSCRIPT_FORMAT.ZOOM;
  }

  // Slack — strict Slack-export pattern: bracketed time, name, then
  // the APP marker on the next line. This is intentionally narrow so
  // generic "Maya: hi" meeting transcripts don't trip it.
  if (
    /\[\d{1,2}:\d{2}\]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\nAPP/.test(text)
  ) {
    return TRANSCRIPT_FORMAT.SLACK;
  }

  // Standard meeting — "Firstname:" or "Firstname Lastname:" at the
  // start of a line, followed by a space.
  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)?:\s/m.test(text)) {
    return TRANSCRIPT_FORMAT.MEETING;
  }

  return TRANSCRIPT_FORMAT.OTHER;
}

// Format-specific guidance dropped into the AI prompt so the model
// reads each platform with the right lens.
export function transcriptFormatPromptContext(
  format: TranscriptFormat,
): string {
  switch (format) {
    case TRANSCRIPT_FORMAT.DISCORD:
      return "This is a Discord chat export. Treat messages where someone says they will do something as commitments. Casual tone does not mean less accountability.";
    case TRANSCRIPT_FORMAT.SLACK:
      return "This is a Slack export. Extract task assignments from threaded conversations.";
    case TRANSCRIPT_FORMAT.WHATSAPP:
      return "This is a WhatsApp chat. Look for task assignments and acknowledgements.";
    case TRANSCRIPT_FORMAT.EMAIL:
      return "This is an email thread. Look for requests, confirmations, and commitments.";
    case TRANSCRIPT_FORMAT.MEETING:
      return "This is a formal meeting transcript. Extract action items, decisions, commitments.";
    case TRANSCRIPT_FORMAT.ZOOM:
      return "This is a Zoom auto-transcript. Speaker labels are reliable. Extract all action items and commitments.";
    case TRANSCRIPT_FORMAT.OTHER:
    default:
      return "Analyse as team communication. Extract commitments, tasks, accountability.";
  }
}

type FormatPalette = { color: string; label: string };

const FORMAT_PALETTE: Record<string, FormatPalette> = {
  [TRANSCRIPT_FORMAT.DISCORD]: { color: "#7C3AED", label: "DISCORD" },
  [TRANSCRIPT_FORMAT.SLACK]: { color: "#4F46E5", label: "SLACK" },
  [TRANSCRIPT_FORMAT.WHATSAPP]: { color: "#16A34A", label: "WHATSAPP" },
  [TRANSCRIPT_FORMAT.EMAIL]: { color: "#6B7280", label: "EMAIL" },
  [TRANSCRIPT_FORMAT.ZOOM]: { color: "#2563EB", label: "ZOOM" },
  [TRANSCRIPT_FORMAT.MEETING]: { color: "#6B7280", label: "MEETING" },
  [TRANSCRIPT_FORMAT.OTHER]: { color: "#6B7280", label: "OTHER" },
};

export function transcriptFormatPalette(
  format: string | null | undefined,
): FormatPalette {
  if (!format) return FORMAT_PALETTE[TRANSCRIPT_FORMAT.OTHER];
  return FORMAT_PALETTE[format] ?? FORMAT_PALETTE[TRANSCRIPT_FORMAT.OTHER];
}
