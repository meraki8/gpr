import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// Payload schema that Make.com should send.
// In Make.com: Jira module → HTTP module → map these fields.
const JiraEventSchema = z.object({
  event_type: z.enum([
    "issue_created",
    "issue_updated",
    "issue_completed",
    "issue_overdue",
    "issue_stale",
  ]),
  issue_key: z.string().min(1),
  issue_id: z.string().min(1),
  summary: z.string().min(1),
  status: z.string().optional(),
  assignee_account_id: z.string().optional().nullable(),
  assignee_display_name: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  priority: z.string().optional().nullable(),
});

const CARD_WEIGHTS: Record<string, number> = {
  issue_completed: 2.0,
  issue_created: 0.5,
  issue_updated: 0.5,
  issue_overdue: 0,
  issue_stale: 0,
};

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const secret = searchParams.get("secret");

  if (!projectId || !secret) {
    return NextResponse.json({ error: "Missing projectId or secret" }, { status: 400 });
  }

  const source = await db.contributionSource.findUnique({
    where: { projectId_sourceType: { projectId, sourceType: "JIRA" } },
  });

  if (!source || !source.enabled) {
    return NextResponse.json({ error: "Jira source not found" }, { status: 404 });
  }

  const config = source.configJson as { webhookSecret?: string; projectKey?: string };
  if (!config.webhookSecret || config.webhookSecret !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = JiraEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const event = parsed.data;

  // Resolve the GPR user from the Jira assignee account ID.
  let userId: string | null = null;
  if (event.assignee_account_id) {
    const identity = await db.sourceIdentity.findUnique({
      where: {
        projectId_sourceType_externalId: {
          projectId,
          sourceType: "JIRA",
          externalId: event.assignee_account_id,
        },
      },
      include: { projectMember: true },
    });
    userId = identity?.projectMember.userId ?? null;
  }

  // Persist the contribution event (idempotent via skipDuplicates).
  const externalId = `${event.event_type}-${event.issue_id}-${Date.now()}`;
  await db.contributionEvent.create({
    data: {
      projectId,
      sourceId: source.id,
      sourceType: "JIRA",
      externalId,
      eventType: event.event_type,
      payloadJson: {
        issueKey: event.issue_key,
        summary: event.summary,
        status: event.status ?? null,
        assigneeAccountId: event.assignee_account_id ?? null,
        assigneeDisplayName: event.assignee_display_name ?? null,
        dueDate: event.due_date ?? null,
        url: event.url ?? null,
        priority: event.priority ?? null,
        login: event.assignee_display_name ?? null,
        title: `[${event.issue_key}] ${event.summary}`,
      },
      userId,
      weight: CARD_WEIGHTS[event.event_type] ?? 0.5,
      occurredAt: new Date(),
    },
  });

  // Auto-issue a yellow card for overdue issues with a known assignee.
  if (event.event_type === "issue_overdue" && userId) {
    await db.card.create({
      data: {
        projectId,
        userId,
        cardType: "YELLOW",
        reason: `Jira ticket ${event.issue_key} is overdue: "${event.summary}"`,
        evidenceJson: {
          issueKey: event.issue_key,
          summary: event.summary,
          dueDate: event.due_date ?? null,
          url: event.url ?? null,
        },
      },
    });
  }

  await db.contributionSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
