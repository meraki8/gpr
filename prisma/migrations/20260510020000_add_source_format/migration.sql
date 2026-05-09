-- Auto-detected platform format on transcripts (discord, slack,
-- whatsapp, email, zoom, meeting, other). Distinct from the
-- TranscriptSource enum which is just the upload origin (PASTE/FILE).
ALTER TABLE "Transcript" ADD COLUMN "sourceFormat" TEXT;

-- Same tag is copied onto KB entries that came out of analysis so the
-- KB UI can render a dual badge ("TRANSCRIPT · DISCORD" etc.).
ALTER TABLE "KnowledgeEntry" ADD COLUMN "sourceFormat" TEXT;
