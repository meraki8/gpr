import "server-only";
import { ai, AI_MODEL } from "./ai";

// Acceptance criteria are pulled out of the description body. We
// look for an "Acceptance Criteria" header in any common form
// (markdown ##, all-caps, trailing colon) and then scan that
// section for `[ ]` / `[x]` checklist items.

export type AcItem = {
  text: string;
  selfReportedDone: boolean;
};

const HEADER_REGEX =
  /^\s*(?:#{1,6}\s*)?acceptance\s*criteria\s*:?\s*$/im;
const CHECKLIST_LINE_REGEX = /^\s*\[\s*([ xX])\s*\]\s+(.+?)\s*$/;
const NEXT_HEADER_REGEX = /^\s*#{1,6}\s+\S/;

export function parseAcceptanceCriteria(description: string): AcItem[] {
  if (!description) return [];
  const lines = description.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => HEADER_REGEX.test(l));
  if (headerIdx === -1) return [];

  const items: AcItem[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (NEXT_HEADER_REGEX.test(line)) break;
    const match = line.match(CHECKLIST_LINE_REGEX);
    if (match) {
      items.push({
        text: match[2].trim(),
        selfReportedDone: match[1].toLowerCase() === "x",
      });
    }
  }
  return items;
}

export type AcJudgement = {
  acText: string;
  selfReportedDone: boolean;
  aiThinksDone: boolean;
  reason: string;
};

export type AcVerdict = {
  allMet: boolean;
  judgements: AcJudgement[];
  summary: string;
};

// Asks the model to judge each AC against the issue description
// and recent comments. Strict JSON output to avoid free-form
// rambling that we'd then have to parse heuristically.
export async function judgeAcceptanceCriteria(input: {
  issueKey: string;
  summary: string;
  description: string;
  acItems: AcItem[];
  comments: string[];
}): Promise<AcVerdict> {
  if (input.acItems.length === 0) {
    return {
      allMet: true,
      judgements: [],
      summary: "No acceptance criteria provided.",
    };
  }

  const prompt = [
    `You are reviewing a Jira ticket marked as Done.`,
    `Decide for each acceptance criterion whether the available evidence shows it has been met.`,
    `Be strict but fair: if a criterion is vague or there is no concrete evidence, mark it not done.`,
    ``,
    `TICKET: ${input.issueKey} — ${input.summary}`,
    ``,
    `DESCRIPTION:`,
    input.description.slice(0, 4000) || "(empty)",
    ``,
    `RECENT COMMENTS:`,
    input.comments.slice(0, 8).map((c, i) => `${i + 1}. ${c.slice(0, 800)}`).join("\n") ||
      "(no comments)",
    ``,
    `ACCEPTANCE CRITERIA:`,
    input.acItems
      .map(
        (ac, i) =>
          `${i + 1}. [team marked ${ac.selfReportedDone ? "DONE" : "NOT DONE"}] ${ac.text}`,
      )
      .join("\n"),
    ``,
    `Respond as JSON: {"judgements": [{"index": 1, "done": true|false, "reason": "..."}], "summary": "..."}`,
  ].join("\n");

  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: {
    judgements?: { index?: number; done?: boolean; reason?: string }[];
    summary?: string;
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const judgements: AcJudgement[] = input.acItems.map((ac, i) => {
    const j = parsed.judgements?.find((x) => x.index === i + 1);
    return {
      acText: ac.text,
      selfReportedDone: ac.selfReportedDone,
      aiThinksDone: j?.done === true,
      reason: j?.reason?.slice(0, 400) ?? "(no reason returned)",
    };
  });

  return {
    allMet: judgements.every((j) => j.aiThinksDone),
    judgements,
    summary:
      parsed.summary?.slice(0, 600) ??
      (judgements.every((j) => j.aiThinksDone)
        ? "All acceptance criteria appear met."
        : "Some acceptance criteria are not yet met."),
  };
}
