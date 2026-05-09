import "server-only";
import { ai, AI_MODEL } from "./ai";

// Acceptance-criteria evaluation. Rather than regex-parse the
// description into structured AC items (which only works for one
// rigid format), we hand the whole description + comments to the
// model and let it identify the criteria — in any format the team
// wrote them — and judge each one against the available evidence.
//
// Cost is ~$0.0005 per call with the mini model. Worth the
// flexibility.

export type AcJudgement = {
  acText: string;
  selfReportedDone: boolean | null;
  aiThinksDone: boolean;
  reason: string;
};

export type AcVerdict = {
  hasAc: boolean;
  allMet: boolean;
  judgements: AcJudgement[];
  summary: string;
};

export const AC_JUDGE_VERSION = 3;

const EMPTY_VERDICT: AcVerdict = {
  hasAc: false,
  allMet: true,
  judgements: [],
  summary: "No acceptance criteria found in the description.",
};

function extractAcceptanceCriteriaCandidates(description: string): string[] {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: string[] = [];
  let inAcSection = false;

  for (const line of lines) {
    const heading = line
      .replace(/^#+\s*/, "")
      .replace(/[*_`]/g, "")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();

    if (/^(acceptance criteria|ac|definition of done)$/.test(heading)) {
      inAcSection = true;
      continue;
    }
    if (inAcSection && /^#{1,6}\s+\S/.test(line)) break;

    const checklistMatch = line.match(/^\[( |x|X)\]\s+(.+)$/);
    const bulletMatch = inAcSection
      ? line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/)
      : null;
    const text = checklistMatch?.[2] ?? bulletMatch?.[1];
    if (text) candidates.push(text.trim());
  }

  return [...new Set(candidates)].slice(0, 20);
}

function isPlausibleAcceptanceCriterion(text: string): boolean {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();

  if (cleaned.length < 12) return false;
  if (cleaned.split(/\s+/).length < 3) return false;
  if (/^[\d\s+\-*/=().]+$/.test(cleaned)) return false;
  if (/^(yes|no|maybe|true|false|n\/a|done|todo)$/i.test(cleaned)) {
    return false;
  }
  if (
    /figment of my imagination/i.test(cleaned) ||
    /^the project exists\.?$/i.test(cleaned)
  ) {
    return false;
  }

  const hasTestableVerb =
    /\b(can|shows?|displays?|returns?|creates?|updates?|saves?|rejects?|accepts?|sends?|receives?|loads?|persists?|appears?|opens?|closes?|prevents?|validates?|passes?|fails?|syncs?|maps?|connects?|disconnects?|completes?)\b/.test(
      lower,
    );
  const hasProductSubject =
    /\b(user|admin|member|team|project|page|screen|button|form|api|webhook|jira|ticket|issue|sprint|leaderboard|auth|login|sign in|session|error|app|data|card|status|comment)\b/.test(
      lower,
    );

  return hasTestableVerb && hasProductSubject;
}

export async function judgeAcceptanceCriteria(input: {
  issueKey: string;
  summary: string;
  description: string;
  comments: string[];
  githubEvidence?: {
    repo: string;
    path: string;
    url: string;
    content: string;
  }[];
}): Promise<AcVerdict> {
  // Skip the API call entirely if there's nothing to evaluate.
  if (!input.description || input.description.trim().length < 10) {
    return EMPTY_VERDICT;
  }

  const candidates = extractAcceptanceCriteriaCandidates(input.description).filter(
    isPlausibleAcceptanceCriterion,
  );
  if (candidates.length === 0) {
    return EMPTY_VERDICT;
  }

  const prompt = [
    `You are reviewing a Jira ticket marked as Done.`,
    `You will receive candidate acceptance criteria extracted from the ticket description.`,
    `Only keep candidates that are real acceptance criteria: concrete, testable product or project outcomes that a reviewer could verify from the ticket, comments, linked work, or demo evidence.`,
    `Ignore candidates that are not real acceptance criteria, including:`,
    `  - one-word answers such as "yes", "no", or "maybe"`,
    `  - jokes, contradictions, tautologies, arithmetic, or philosophical statements`,
    `  - vague statements with no product/project outcome`,
    `  - meta statements such as "the project exists" unless the ticket is specifically about proving project creation or existence`,
    `If no candidates are real acceptance criteria, return hasAc=false and an empty judgements list.`,
    ``,
    `For each real criterion you keep, decide whether it is met.`,
    input.githubEvidence && input.githubEvidence.length > 0
      ? `GitHub code evidence is available. Use it as the primary implementation evidence: routes, components, labels, API handlers, and tests can prove an AC is met.`
      : `No GitHub code evidence is available for this ticket.`,
    `If GitHub code evidence clearly implements or tests a criterion, mark it met even if there are no Jira comments.`,
    `If GitHub code evidence is available but contradicts or lacks the implementation for a specific concrete criterion, mark that criterion not met.`,
    `The Jira ticket is already marked Done. Treat that Done status as the team's completion claim for normal, concrete acceptance criteria.`,
    `A markdown checkbox marker under Acceptance Criteria is formatting, not proof that the criterion is incomplete. Do not fail a criterion only because it is written with [ ].`,
    `Mark a real criterion not met only when the description or comments directly say it is missing, blocked, failing, contradicted, impossible, or outside the completed work.`,
    `Do not require comments, links, screenshots, or extra evidence for simple criteria when the Done ticket itself reasonably supports completion.`,
    `Set selfReportedDone=true only for explicit prose or [x] saying the criterion is done. For [ ] criteria, set selfReportedDone=null unless the text explicitly says it is incomplete.`,
    `Do not invent criteria. Do not include ignored candidates in judgements.`,
    ``,
    `TICKET: ${input.issueKey} — ${input.summary}`,
    ``,
    `CANDIDATE CRITERIA:`,
    candidates.map((c, i) => `${i + 1}. ${c.slice(0, 400)}`).join("\n"),
    ``,
    `DESCRIPTION:`,
    input.description.slice(0, 6000),
    ``,
    `RECENT COMMENTS:`,
    input.comments.slice(0, 8).map((c, i) => `${i + 1}. ${c.slice(0, 800)}`).join("\n") ||
      "(no comments)",
    ``,
    `GITHUB CODE EVIDENCE:`,
    input.githubEvidence && input.githubEvidence.length > 0
      ? input.githubEvidence
          .slice(0, 8)
          .map(
            (e, i) =>
              `FILE ${i + 1}: ${e.repo}/${e.path}\nURL: ${e.url}\n${e.content.slice(0, 5000)}`,
          )
          .join("\n\n---\n\n")
      : "(none)",
    ``,
    `Respond as JSON:`,
    `{`,
    `  "hasAc": true|false,`,
    `  "judgements": [`,
    `    { "acText": "...", "selfReportedDone": true|false|null, "aiThinksDone": true|false, "reason": "..." }`,
    `  ],`,
    `  "summary": "one-sentence overall verdict"`,
    `}`,
  ].join("\n");

  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: {
    hasAc?: boolean;
    judgements?: {
      acText?: string;
      selfReportedDone?: boolean | null;
      aiThinksDone?: boolean;
      reason?: string;
    }[];
    summary?: string;
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_VERDICT;
  }

  const judgements: AcJudgement[] = (parsed.judgements ?? [])
    .filter((j) => j.acText && j.acText.trim().length > 0)
    .filter((j) => isPlausibleAcceptanceCriterion(j.acText!))
    .map((j) => ({
      acText: j.acText!.trim().slice(0, 400),
      selfReportedDone: j.selfReportedDone === true ? true : null,
      aiThinksDone: j.aiThinksDone === true,
      reason: (j.reason ?? "").slice(0, 400) || "(no reason returned)",
    }));

  const hasAc = judgements.length > 0 && parsed.hasAc !== false;

  return {
    hasAc,
    allMet: hasAc ? judgements.every((j) => j.aiThinksDone) : true,
    judgements,
    summary:
      parsed.summary?.slice(0, 600) ??
      (hasAc
        ? judgements.every((j) => j.aiThinksDone)
          ? "All acceptance criteria appear met."
          : "Some acceptance criteria are not met."
        : "No acceptance criteria found in the description."),
  };
}
