"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zodTextFormat } from "openai/helpers/zod";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { ai, AI_MODEL } from "@/lib/ai";
import { MatchAnalysis } from "@/lib/types";
import { getBaseUrl } from "@/lib/url";
import {
  KB_SOURCES,
  addKnowledgeEntries,
  formatKbForPrompt,
  getRecentKbEntries,
} from "@/lib/kb";
import { CAPABILITIES, resolveCapability } from "@/lib/capabilities";
import { recomputeMemberScores } from "@/lib/scoring";
import { recordProjectHealthSnapshot } from "@/lib/health";

const InviteSchema = z.object({
  projectId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email address required"),
});

export async function inviteMemberAction(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  try {
    await inviteMember(formData);
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invite" };
  }
}

export async function inviteMember(formData: FormData) {
  const user = await requireDbUser();

  const parsed = InviteSchema.safeParse({
    projectId: formData.get("projectId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, email } = parsed.data;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
  });
  if (!project) throw new Error("FORBIDDEN");

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: existingUser.id },
      },
    });
    if (alreadyMember) {
      throw new Error("That person is already a member of this project");
    }
  }

  // Block re-inviting an email that already accepted a previous invite.
  const acceptedInvite = await db.projectInvite.findFirst({
    where: { projectId, email, acceptedAt: { not: null } },
  });
  if (acceptedInvite) {
    throw new Error("That person has already accepted an invite to this project");
  }

  // Block duplicate pending invites for the same email.
  const pendingInvite = await db.projectInvite.findFirst({
    where: { projectId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pendingInvite) {
    throw new Error("An invite is already pending for that email");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.projectInvite.create({
    data: {
      projectId,
      email,
      token,
      invitedBy: user.id,
      expiresAt,
    },
  });

  await sendInviteEmail({
    to: email,
    inviterName: user.name ?? user.email,
    projectName: project.name,
    projectBrief: project.brief,
    inviteUrl: `${getBaseUrl()}/invite/${token}`,
  });

  revalidatePath(`/projects/${projectId}`);
}

const CancelInviteSchema = z.object({
  inviteId: z.string().min(1),
});

export async function cancelInvite(formData: FormData) {
  const user = await requireDbUser();

  const parsed = CancelInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const invite = await db.projectInvite.findFirst({
    where: {
      id: parsed.data.inviteId,
      acceptedAt: null,
      project: {
        deletedAt: null,
        members: { some: { userId: user.id, role: "OWNER" } },
      },
    },
  });
  if (!invite) throw new Error("FORBIDDEN");

  // Set expiresAt to now so the token is immediately dead.
  await db.projectInvite.update({
    where: { id: invite.id },
    data: { expiresAt: new Date() },
  });

  revalidatePath(`/projects/${invite.projectId}/members`);
}

const ResendInviteSchema = z.object({
  inviteId: z.string().min(1),
});

export async function resendInvite(inviteId: string) {
  const user = await requireDbUser();

  const parsed = ResendInviteSchema.safeParse({ inviteId });
  if (!parsed.success) throw new Error("Invalid input");

  const invite = await db.projectInvite.findFirst({
    where: {
      id: parsed.data.inviteId,
      project: {
        deletedAt: null,
        members: { some: { userId: user.id } },
      },
    },
    include: { project: true },
  });
  if (!invite) throw new Error("FORBIDDEN");
  if (invite.acceptedAt) throw new Error("Invite already accepted");

  // Reset the 7-day expiry from now; reuse the existing token so any
  // already-sent link still works.
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.projectInvite.update({
    where: { id: invite.id },
    data: { expiresAt: newExpiresAt },
  });

  await sendInviteEmail({
    to: invite.email,
    inviterName: user.name ?? user.email,
    projectName: invite.project.name,
    projectBrief: invite.project.brief,
    inviteUrl: `${getBaseUrl()}/invite/${invite.token}`,
  });

  revalidatePath(`/projects/${invite.projectId}`);
}

const TranscriptInputSchema = z.object({
  projectId: z.string().min(1),
  rawText: z.string(),
  title: z
    .string()
    .trim()
    .max(200, "Title is too long")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  meetingAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

// Cheap text similarity (no AI). Matches on length proximity + word
// overlap on the normalized first 500 chars. Catches "user pasted the
// same transcript twice" without needing token embeddings.
function normalizeForSim(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function transcriptSimilarity(a: string, b: string): number {
  const aN = normalizeForSim(a);
  const bN = normalizeForSim(b);
  const maxLen = Math.max(aN.length, bN.length, 1);
  const lengthSim = 1 - Math.abs(aN.length - bN.length) / maxLen;

  const headA = aN.slice(0, 500);
  const headB = bN.slice(0, 500);
  const tokA = new Set(
    headA.split(/\W+/).filter((t) => t.length >= 2),
  );
  const tokB = new Set(
    headB.split(/\W+/).filter((t) => t.length >= 2),
  );
  const inter = [...tokA].filter((t) => tokB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  const jaccard = union === 0 ? 0 : inter / union;

  return (lengthSim + jaccard) / 2;
}

const DUPLICATE_PREFIX = "DUPLICATE_TRANSCRIPT|";

async function readUploadedTranscriptFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    // Lazy-import unpdf so the heavy pdfjs build only loads when a
    // PDF actually shows up.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  // Treat anything else as plain text — covers .txt, .md, and any
  // mistakenly-typed file the user pastes into the upload field.
  return new TextDecoder().decode(buf);
}

export async function analyzeTranscript(formData: FormData) {
  const user = await requireDbUser();

  const fileEntry = formData.get("file");
  const file =
    fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  let rawText = (formData.get("rawText") ?? "").toString();
  if (file) {
    const fromFile = await readUploadedTranscriptFile(file);
    // If the user pasted AND uploaded, concatenate paste-first so the
    // user's annotations come before the file body.
    rawText = rawText.trim()
      ? `${rawText.trim()}\n\n${fromFile}`
      : fromFile;
  }
  rawText = rawText.trim();

  if (rawText.length < 20) {
    throw new Error("Transcript looks too short to analyze");
  }

  const parsed = TranscriptInputSchema.safeParse({
    projectId: formData.get("projectId"),
    rawText,
    title: formData.get("title") ?? undefined,
    meetingAt: formData.get("meetingAt") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, title } = parsed.data;
  // datetime-local sends "YYYY-MM-DDTHH:MM" — Date constructor parses
  // it in local time, which is what the user means.
  const meetingAt = parsed.data.meetingAt
    ? new Date(parsed.data.meetingAt)
    : null;
  if (meetingAt && Number.isNaN(meetingAt.getTime())) {
    throw new Error("Invalid meeting timestamp");
  }

  // Permission via capability — owner always has it; for members,
  // run_analysis defaults enabled and can be toggled off by the owner
  // on the Members page.
  const membership = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      project: { deletedAt: null },
    },
    include: {
      capabilities: { select: { capability: true, enabled: true } },
    },
  });
  if (!membership) {
    throw new Error("You don't have access to this project");
  }
  const canRun = resolveCapability(
    membership.role,
    CAPABILITIES.RUN_ANALYSIS,
    membership.capabilities,
  );
  if (!canRun) {
    throw new Error(
      "You do not have permission to run analysis on this project.",
    );
  }

  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { members: { include: { user: true } } },
  });
  if (!project) throw new Error("Project not found");

  // Duplicate check — skip when the user has already confirmed they
  // know this looks like an existing upload. Limit comparison to the
  // most recent transcripts; older ones are unlikely candidates.
  const confirmDuplicate =
    (formData.get("confirmDuplicate") ?? "").toString() === "true";
  if (!confirmDuplicate) {
    const recent = await db.transcript.findMany({
      where: { projectId },
      select: {
        id: true,
        rawText: true,
        createdAt: true,
        meetingAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    for (const existing of recent) {
      const score = transcriptSimilarity(rawText, existing.rawText);
      if (score >= 0.8) {
        const ref = existing.meetingAt ?? existing.createdAt;
        // Sentinel error — the form parses this prefix to render a
        // "Run anyway" confirmation rather than treat it as a hard
        // failure.
        throw new Error(`${DUPLICATE_PREFIX}${ref.toISOString()}`);
      }
    }
  }

  // 1. Save raw transcript first so it's persisted even if AI fails.
  const transcript = await db.transcript.create({
    data: {
      projectId,
      uploadedBy: user.id,
      rawText,
      title: title ?? null,
      meetingAt,
      source: file ? "FILE" : "PASTE",
    },
  });

  // 2. Build the system prompt with project + member context.
  const memberLines = project.members
    .map(
      (m) =>
        `- userId: "${m.user.id}", name: "${m.user.name ?? m.user.email}"`,
    )
    .join("\n");

  // Pull the most recent KB entries so the AI has running project
  // context (prior decisions, commitments, GitHub activity, manual
  // notes) — each analysis gets smarter over time.
  const recentKb = await getRecentKbEntries(projectId, 10);
  const kbBlock = formatKbForPrompt(recentKb);

  const instructions = [
    "You are GPR, an AI referee for group projects. Your job is to read meeting transcripts and produce honest, structured Match Reports that hold members accountable based on what they actually did and said.",
    "",
    "RULES:",
    "- Use the EXACT userId values from the members list below. Do not invent userIds.",
    "- Be honest. Don't sugarcoat. Don't fabricate. If a member did not speak, say so.",
    "- contribution_score: 0-100 relative to peers in this single meeting. A silent member should score low (5-20). A member carrying the meeting should score high (80+).",
    "- speaking_time_pct: rough estimate of share of speaking time, 0-100.",
    "- Quote source_quote VERBATIM from the transcript when capturing commitments.",
    "- Cards are draft signals, not final judgments. Be conservative — only issue when clearly warranted:",
    "  * YELLOW: falling behind, missed deadline mentioned, low engagement",
    "  * RED: ghosting, MIA, no engagement at all in the meeting",
    "  * MVP: clearly carrying the team this session",
    "- A meeting can produce zero cards. That's fine. Don't force them.",
    "- summary: 1-3 sentences capturing the meeting's overall outcome and team health.",
    "- key_knowledge: 3-5 durable facts from THIS meeting worth saving to the project knowledge base. Decisions, scope changes, owned commitments, blockers. Skip social chatter and anything already covered in 'PROJECT KNOWLEDGE' below — don't restate prior context.",
    "  * assigned_to: name of the person responsible if the transcript clearly assigns it (use the speaker's name as it appears). Null when no clear owner.",
    "  * target_date_iso: ISO date (YYYY-MM-DD) of the deadline if mentioned. Resolve relative dates ('Friday', 'next Tuesday', 'EOD Wednesday') against the meeting time given above. Null when no date is mentioned.",
    "",
    "PROJECT:",
    `Name: ${project.name}`,
    `Brief: ${project.brief}`,
    "",
    "MEETING:",
    title ? `Title: ${title}` : "Title: (not provided — infer from content)",
    meetingAt
      ? `When: ${meetingAt.toISOString()}`
      : "When: (not provided)",
    "",
    "PROJECT KNOWLEDGE (recent, newest first — use as background, do not re-extract):",
    kbBlock,
    "",
    "MEMBERS:",
    memberLines,
  ].join("\n");

  // 3. Call the OpenAI Responses API with a Zod-bound JSON schema.
  const rsp = await ai.responses.parse({
    model: AI_MODEL,
    instructions,
    input: rawText,
    text: { format: zodTextFormat(MatchAnalysis, "match_analysis") },
  });

  const analysis = rsp.output_parsed;
  if (!analysis) {
    throw new Error("AI did not return a structured analysis");
  }

  // 4. Defensive validation: AI must use real userIds from the project.
  const validIds = new Set(project.members.map((m) => m.user.id));
  for (const m of analysis.members) {
    if (!validIds.has(m.user_id)) {
      throw new Error(`AI returned unknown userId: ${m.user_id}`);
    }
  }
  for (const c of analysis.cards) {
    if (!validIds.has(c.user_id)) {
      throw new Error(`AI returned unknown userId in card: ${c.user_id}`);
    }
  }

  // 5. Persist Match Report + nested Member Reports + draft Cards.
  const now = new Date();
  const reportPeriod = meetingAt ?? now;
  const matchReport = await db.matchReport.create({
    data: {
      projectId,
      transcriptId: transcript.id,
      summary: analysis.summary,
      periodStart: reportPeriod,
      periodEnd: reportPeriod,
      memberReports: {
        create: analysis.members.map((m) => ({
          userId: m.user_id,
          contributionScore: m.contribution_score,
          speakingTimePct: m.speaking_time_pct,
          commitmentsJson: m.commitments,
          notes: m.notes,
        })),
      },
      cards: {
        create: analysis.cards.map((c) => ({
          projectId,
          userId: c.user_id,
          cardType: c.card_type,
          reason: c.reason,
          evidenceJson: { quotes: c.evidence_quotes },
        })),
      },
    },
  });

  // 6. Persist extracted facts as KB entries. Best-effort — a failure
  // here shouldn't roll back the analysis the user just paid for.
  if (analysis.key_knowledge.length > 0) {
    try {
      await addKnowledgeEntries(
        analysis.key_knowledge.map((k, idx) => {
          let targetDate: Date | null = null;
          if (k.target_date_iso) {
            const parsed = new Date(k.target_date_iso);
            if (!Number.isNaN(parsed.getTime())) targetDate = parsed;
          }
          return {
            projectId,
            source: KB_SOURCES.TRANSCRIPT,
            title: k.title,
            content: k.content,
            // Per-entry deterministic ref so repeat analyses on the same
            // report don't double-insert.
            sourceRefId: `${matchReport.id}:${idx}`,
            sourceTypeLabel: "Match report",
            assignedTo: k.assigned_to ?? null,
            targetDate,
          };
        }),
      );
    } catch (err) {
      console.error("Failed to persist KB entries from transcript:", err);
    }
  }

  // 7. Recompute cumulative scores now that this report's
  // MemberReports + cards exist. Best-effort — a failure shouldn't
  // roll back the analysis.
  try {
    await recomputeMemberScores(projectId, "transcript analysis");
  } catch (err) {
    console.error("Failed to recompute member scores:", err);
  }

  // 8. Snapshot the project health score against this report so the
  // overview can show "X since last meeting".
  try {
    await recordProjectHealthSnapshot(
      projectId,
      "transcript analysis",
      matchReport.id,
    );
  } catch (err) {
    console.error("Failed to snapshot project health:", err);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/kb`);
  revalidatePath(`/projects/${projectId}/transcripts`);
  revalidatePath(`/projects/${projectId}/reports`);
  revalidatePath(`/projects/${projectId}/leaderboard`);
  revalidatePath(`/projects/${projectId}/members`);
  redirect(`/projects/${projectId}/reports/${matchReport.id}`);
}
