import { z } from "zod";

// AI-structured output schemas for transcript analysis (used with
// zodTextFormat in the OpenAI Responses API). Snake_case to match
// the JSON wire format the model emits; convert to camelCase when
// persisting via Prisma.

export const Commitment = z.object({
  text: z.string().describe("What the member said they would do"),
  due_date_iso: z
    .string()
    .nullable()
    .describe("ISO date if mentioned, else null"),
  source_quote: z.string().describe("Exact verbatim quote from the transcript"),
});

export const MemberAnalysis = z.object({
  user_id: z
    .string()
    .describe("The exact userId from the project members list"),
  contribution_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100, relative to peers in this meeting"),
  speaking_time_pct: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated share of speaking time, 0-100"),
  commitments: z.array(Commitment),
  notes: z
    .string()
    .describe("One- or two-sentence honest assessment of the member"),
});

export const CardDraft = z.object({
  user_id: z.string(),
  card_type: z
    .enum(["YELLOW", "RED", "MVP"])
    .describe(
      "YELLOW = falling behind, RED = ghosting/MIA, MVP = top contributor",
    ),
  reason: z.string().describe("One-sentence justification for the card"),
  evidence_quotes: z
    .array(z.string())
    .describe("Verbatim quotes from the transcript that support the card"),
});

export const KnowledgeFact = z.object({
  title: z
    .string()
    .describe("Short noun-phrase headline (under 80 chars)"),
  content: z
    .string()
    .describe(
      "1-3 sentence statement of the decision, commitment, or context. Self-contained — readable without the transcript.",
    ),
  assigned_to: z
    .string()
    .nullable()
    .describe(
      "Name of the person responsible for this item if the transcript clearly assigns it. Use the speaker's name as it appears. Null if no clear owner.",
    ),
  target_date_iso: z
    .string()
    .nullable()
    .describe(
      "ISO date (YYYY-MM-DD) of the deadline if mentioned (e.g. 'by Friday', 'next Tuesday', 'EOD Wednesday'). Resolve relative dates against the meeting timestamp provided in the prompt. Null if no date is mentioned.",
    ),
});

export const MatchAnalysis = z.object({
  summary: z
    .string()
    .describe("1-3 sentence overall assessment of the meeting"),
  members: z.array(MemberAnalysis),
  cards: z.array(CardDraft),
  key_knowledge: z
    .array(KnowledgeFact)
    .describe(
      "3-5 durable facts from this meeting worth remembering for future analyses: decisions made, commitments owned, scope changes, blockers. Skip pleasantries and idle chatter.",
    ),
});

export type MatchAnalysisType = z.infer<typeof MatchAnalysis>;
