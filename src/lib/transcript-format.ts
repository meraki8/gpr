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

// Heuristic detector. Order matters — the more distinctive patterns
// win. Falls back to "other" when nothing matches.
export function detectTranscriptFormat(text: string): TranscriptFormat {
  if (!text) return TRANSCRIPT_FORMAT.OTHER;

  // Discord — bracketed AM/PM stamps with channel hashtags, or
  // Discord's "Today at hh:mm" relative timestamp format.
  if (/\[\d{1,2}:\d{2} [AP]M\]/.test(text) && text.includes("#")) {
    return TRANSCRIPT_FORMAT.DISCORD;
  }
  if (/Today at \d{1,2}:\d{2}/.test(text)) {
    return TRANSCRIPT_FORMAT.DISCORD;
  }

  // Slack — bare time stamp followed by a username on the next line.
  if (/\d{1,2}:\d{2} [AP]M\n[A-Z]/.test(text)) {
    return TRANSCRIPT_FORMAT.SLACK;
  }

  // WhatsApp — date + time prefix on each line.
  if (/\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/.test(text)) {
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

  // Zoom / Teams auto-transcript — VTT marker or a Zoom footer.
  if (text.includes("WEBVTT") || text.includes("Transcription by")) {
    return TRANSCRIPT_FORMAT.ZOOM;
  }

  // Standard "Firstname Lastname:" speaker labels at line starts.
  if (/^[A-Z][a-z]+ [A-Z][a-z]+:/m.test(text)) {
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
