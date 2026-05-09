import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Allow long streams — KB-grounded answers can run a few seconds.
export const maxDuration = 60;

// Hardcoded for chat: the rest of the app uses gpt-5.4-mini via the
// OpenAI Responses API, which the AI SDK's `openai()` chat-completions
// provider does not appear to resolve cleanly. gpt-4o-mini is a
// well-known, broadly-available chat model that this provider handles
// without surprises. If chat ever feels too weak we can lift this.
const CHAT_MODEL = "gpt-4o-mini";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const user = await requireDbUser();

  // Auth: caller must be a member of this (non-deleted) project.
  const member = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      project: { deletedAt: null },
    },
    include: { project: { select: { id: true, name: true, brief: true } } },
  });
  if (!member) {
    return new Response("You don't have access to this project.", {
      status: 403,
    });
  }

  // Viewer context: rank within the project, cards received, and the
  // count of meetings they appear in. Used to seed the "YOU ARE TALKING
  // TO" header so the model can answer "what's my score / rank / cards"
  // without claiming ignorance.
  const [memberRows, viewerCards, viewerMeetingCount] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId },
      orderBy: [{ contributionScore: "desc" }, { joinedAt: "asc" }],
      select: { userId: true },
    }),
    db.card.findMany({
      where: { projectId, userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { cardType: true, reason: true, createdAt: true },
    }),
    db.memberReport.count({
      where: { userId: user.id, matchReport: { projectId } },
    }),
  ]);

  const totalMembers = memberRows.length;
  const viewerRank =
    memberRows.findIndex((m) => m.userId === user.id) + 1 || totalMembers;

  const cardsLine =
    viewerCards.length === 0
      ? "(none)"
      : viewerCards
          .map(
            (c) =>
              `${c.cardType} on ${c.createdAt.toISOString().slice(0, 10)} — ${c.reason}`,
          )
          .join("; ");

  const viewerBlock = [
    "YOU ARE TALKING TO:",
    `Name: ${user.name ?? "(unknown)"}`,
    `Email: ${user.email}`,
    `Role: ${member.role.toLowerCase()}`,
    `Contribution Score: ${member.contributionScore}`,
    `Rank: #${viewerRank} out of ${totalMembers} members`,
    `Cards received: ${cardsLine}`,
    `Meetings participated in: ${viewerMeetingCount}`,
    "",
    "When the user says 'me', 'my', 'I', or 'mine' always refer to this person specifically.",
    "Never say you do not have information about the current user — their data is above.",
  ].join("\n");

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Pull all KB entries — keep the order stable (newest-first) so the
  // [KB-N] indices we hand the model match what the client component
  // captured at page load. If the project has grown beyond ~500
  // entries we cap; the AI can still cite the most recent ones.
  const kbEntries = await db.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      source: true,
      sourceTypeLabel: true,
      title: true,
      content: true,
      assignedTo: true,
      targetDate: true,
      createdAt: true,
    },
  });

  const kbBlock =
    kbEntries.length === 0
      ? "(no entries yet)"
      : kbEntries
          .map((e, i) => {
            const idx = i + 1;
            const meta = [`source: ${e.source}`];
            if (e.sourceTypeLabel) meta.push(`label: ${e.sourceTypeLabel}`);
            if (e.assignedTo) meta.push(`assigned to: ${e.assignedTo}`);
            if (e.targetDate)
              meta.push(`target: ${e.targetDate.toISOString().slice(0, 10)}`);
            meta.push(
              `created: ${e.createdAt.toISOString().slice(0, 10)}`,
            );
            // Truncate very long content per-entry so the prompt stays
            // bounded — keeps total cost reasonable on big KBs.
            const trimmed =
              e.content.length > 800
                ? `${e.content.slice(0, 800).trimEnd()}…`
                : e.content;
            return `[KB-${idx}] ${e.title}\n  ${trimmed}\n  (${meta.join(" · ")})`;
          })
          .join("\n\n");

  const system = [
    viewerBlock,
    "",
    `You are the GPR project assistant for "${member.project.name}".`,
    `You only answer questions about THIS project, based ONLY on the project brief and knowledge base provided below — except for questions about the current user, where the YOU ARE TALKING TO block above is authoritative.`,
    `If the answer is not in the project knowledge base, respond with exactly: "I do not have that information in this project yet."`,
    `When you draw on a knowledge base entry, cite it inline using its tag in square brackets — e.g. [KB-3] or [KB-7]. Cite multiple if they apply.`,
    `Be concise. Don't speculate. Don't fabricate names, dates, or commitments. If a question is ambiguous, ask for clarification.`,
    "",
    "PROJECT BRIEF:",
    member.project.brief || "(no brief provided)",
    "",
    "KNOWLEDGE BASE (newest first):",
    kbBlock,
  ].join("\n");

  // Debug — visible in Vercel logs.
  console.log("[ask] projectId:", projectId);
  console.log("[ask] kb entries fetched:", kbEntries.length);
  console.log("[ask] model:", CHAT_MODEL);
  console.log(
    "[ask] system prompt (first 200 chars):",
    system.slice(0, 200),
  );
  console.log(
    "[ask] system prompt total length:",
    system.length,
    "chars",
  );

  const result = streamText({
    model: openai(CHAT_MODEL),
    system,
    messages: await convertToModelMessages(messages),
    onError: (err) => {
      console.error("[ask] streamText error:", err);
    },
    onFinish: ({ text, finishReason, usage }) => {
      console.log(
        "[ask] model finish — reason:",
        finishReason,
        "tokens:",
        usage,
        "text length:",
        text?.length ?? 0,
      );
      if (text) {
        console.log("[ask] response (first 200 chars):", text.slice(0, 200));
      }
    },
  });

  console.log("[ask] model response started");

  return result.toUIMessageStreamResponse();
}
