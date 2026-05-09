import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AI_MODEL } from "@/lib/ai";

// Allow long streams — KB-grounded answers can run a few seconds.
export const maxDuration = 60;

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
    `You are the GPR project assistant for "${member.project.name}".`,
    `You only answer questions about THIS project, based ONLY on the project brief and knowledge base provided below.`,
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

  const result = streamText({
    model: openai(AI_MODEL),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
