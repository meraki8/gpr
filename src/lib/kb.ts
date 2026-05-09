import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

// Source values used by the rest of the app. The DB stores `source` as
// a free-form string so new providers can be added without a migration;
// these constants are just for type safety at call sites.
export const KB_SOURCES = {
  TRANSCRIPT: "transcript",
  GITHUB: "github",
  JIRA: "jira",
  MANUAL: "manual",
} as const;

export type KbSource = (typeof KB_SOURCES)[keyof typeof KB_SOURCES];

type KbInput = {
  projectId: string;
  source: string;
  title: string;
  content: string;
  sourceRefId?: string | null;
  sourceTypeLabel?: string | null;
  assignedTo?: string | null;
  targetDate?: Date | null;
};

type DbLike = PrismaClient | Prisma.TransactionClient;

export async function addKnowledgeEntry(input: KbInput, client: DbLike = db) {
  return client.knowledgeEntry.create({
    data: {
      projectId: input.projectId,
      source: input.source,
      title: input.title.slice(0, 280),
      content: input.content,
      sourceRefId: input.sourceRefId ?? null,
      sourceTypeLabel: input.sourceTypeLabel ?? null,
      assignedTo: input.assignedTo ?? null,
      targetDate: input.targetDate ?? null,
    },
  });
}

// Bulk write with idempotency: skipDuplicates relies on the
// (projectId, source, sourceRefId) unique index. Manual entries pass
// null sourceRefId and so are never deduped.
export async function addKnowledgeEntries(
  entries: KbInput[],
  client: DbLike = db,
) {
  if (entries.length === 0) return { count: 0 };
  return client.knowledgeEntry.createMany({
    data: entries.map((e) => ({
      projectId: e.projectId,
      source: e.source,
      title: e.title.slice(0, 280),
      content: e.content,
      sourceRefId: e.sourceRefId ?? null,
      sourceTypeLabel: e.sourceTypeLabel ?? null,
      assignedTo: e.assignedTo ?? null,
      targetDate: e.targetDate ?? null,
    })),
    skipDuplicates: true,
  });
}

export async function getRecentKbEntries(projectId: string, limit = 10) {
  return db.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Render KB entries into a compact block for AI prompts. Truncates
// content per-entry so a long history doesn't blow the prompt budget.
export function formatKbForPrompt(
  entries: Array<{
    source: string;
    sourceTypeLabel: string | null;
    title: string;
    content: string;
    createdAt: Date;
  }>,
): string {
  if (entries.length === 0) return "(no prior knowledge yet)";
  return entries
    .map((e) => {
      const label = e.sourceTypeLabel
        ? `${e.source}/${e.sourceTypeLabel}`
        : e.source;
      const date = e.createdAt.toISOString().slice(0, 10);
      const trimmed =
        e.content.length > 400
          ? `${e.content.slice(0, 400).trimEnd()}…`
          : e.content;
      return `- [${date}] (${label}) ${e.title}\n  ${trimmed}`;
    })
    .join("\n");
}
