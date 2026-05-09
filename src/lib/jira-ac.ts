import "server-only";
import { ai, AI_MODEL } from "./ai";

// Acceptance-criteria evaluation. The model reads the full Jira
// description, identifies acceptance criteria in whatever format the
// team used, then judges those criteria against GitHub code evidence.
// Jira status, comments, checkbox state, and team claims do not count
// as proof.
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

export const AC_JUDGE_VERSION = 8;

const EMPTY_VERDICT: AcVerdict = {
  hasAc: false,
  allMet: true,
  judgements: [],
  summary: "No acceptance criteria found in the description.",
};

function countLabel(count: number): string {
  const words = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  return words[count] ?? String(count);
}

function verdictSummary(judgements: AcJudgement[]): string {
  const count = judgements.length;
  const failed = judgements.filter((j) => !j.aiThinksDone).length;
  if (failed === 0) {
    if (count === 1) {
      return "One concrete acceptance criterion was present and is supported by the code evidence.";
    }
    if (count === 2) {
      return "Two concrete acceptance criteria were present and both are supported by the code evidence.";
    }
    return `${countLabel(count)} concrete acceptance criteria were present and all are supported by the code evidence.`;
  }
  return `${countLabel(count)} concrete acceptance ${
    count === 1 ? "criterion was" : "criteria were"
  } present; ${countLabel(failed).toLowerCase()} ${
    failed === 1 ? "is" : "are"
  } not supported by the code evidence.`;
}

export async function judgeAcceptanceCriteria(input: {
  issueKey: string;
  description: string;
  githubEvidence?: {
    repo: string;
    path: string;
    url: string;
    content: string;
  }[];
}): Promise<AcVerdict> {
  // Skip the API call only when there is literally no Jira text to inspect.
  if (!input.description?.trim()) {
    return EMPTY_VERDICT;
  }

  const hasGithubEvidence = Boolean(input.githubEvidence?.length);

  const prompt = [
    `You are reviewing acceptance criteria against GitHub code evidence.`,
    `You will receive the full Jira description.`,
    `First identify the real acceptance criteria directly from that description, regardless of format.`,
    `Acceptance criteria may be written as headings, bullets, numbered lists, checkboxes, prose, user-story wording, Given/When/Then, "done when", requirements, tables, or any other human-readable format.`,
    `Only keep criteria that are concrete, testable product or project outcomes that a reviewer could verify from code.`,
    `Ignore text that is not real acceptance criteria, including:`,
    `  - one-word answers such as "yes", "no", or "maybe"`,
    `  - jokes, contradictions, tautologies, arithmetic, or philosophical statements`,
    `  - vague statements with no product/project outcome`,
    `  - meta statements such as "the project exists" unless the ticket is specifically about proving project creation or existence`,
    `If no real acceptance criteria appear anywhere in the full description, return hasAc=false and an empty judgements list.`,
    ``,
    `For each real criterion you find, decide whether it is met using ONLY the GitHub code evidence.`,
    `Routes, components, labels, API handlers, behavior, and tests in the provided code can prove an AC is met.`,
    `If the provided code evidence does not clearly implement or test a criterion, mark that criterion not met.`,
    `Use the Jira description only to find the acceptance criteria. Do not use the Jira description as proof that work is complete.`,
    `Ignore all non-code factors when judging completion: Jira status, issue title, description claims, comments, links, screenshots, checkbox state, and team completion claims.`,
    `If no GitHub code evidence is provided, every real acceptance criterion must be marked not met.`,
    `Set selfReportedDone=null for every judgement because self-reporting is irrelevant.`,
    `Do not invent criteria. Quote or faithfully paraphrase only criteria that are actually in the description.`,
    ``,
    `TICKET KEY: ${input.issueKey}`,
    ``,
    `FULL JIRA DESCRIPTION:`,
    input.description.slice(0, 12000),
    ``,
    `GITHUB CODE EVIDENCE:`,
    hasGithubEvidence
      ? input.githubEvidence!
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
    `    { "acText": "...", "selfReportedDone": null, "aiThinksDone": true|false, "reason": "code-based explanation" }`,
    `  ],`,
    `  "summary": "one-sentence overall verdict based only on code evidence"`,
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
    .map((j) => ({
      acText: j.acText!.trim().slice(0, 400),
      selfReportedDone: null,
      aiThinksDone: hasGithubEvidence && j.aiThinksDone === true,
      reason:
        !hasGithubEvidence
          ? "No GitHub code evidence was found for this criterion."
          : (j.reason ?? "").slice(0, 400) || "(no reason returned)",
    }));

  const hasAc = judgements.length > 0;
  const allMet = hasAc ? judgements.every((j) => j.aiThinksDone) : true;

  return {
    hasAc,
    allMet,
    judgements,
    summary: hasAc
      ? verdictSummary(judgements)
      : "No acceptance criteria found in the description.",
  };
}
