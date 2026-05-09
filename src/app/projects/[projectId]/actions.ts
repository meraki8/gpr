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

const InviteSchema = z.object({
  projectId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email address required"),
});

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
      throw new Error("That email is already a project member");
    }
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

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      // Analysis is owner-only — drafts are owner-visible, so a member
      // running analysis would 404 on the redirect to the new report.
      members: { some: { userId: user.id, role: "OWNER" } },
    },
    include: { members: { include: { user: true } } },
  });
  if (!project) throw new Error("FORBIDDEN");

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
      status: "DRAFT",
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
          status: "DRAFT",
          aiGenerated: true,
        })),
      },
    },
  });

  // 6. Persist extracted facts as KB entries. Best-effort — a failure
  // here shouldn't roll back the analysis the user just paid for.
  if (analysis.key_knowledge.length > 0) {
    try {
      await addKnowledgeEntries(
        analysis.key_knowledge.map((k, idx) => ({
          projectId,
          source: KB_SOURCES.TRANSCRIPT,
          title: k.title,
          content: k.content,
          // Per-entry deterministic ref so repeat analyses on the same
          // report don't double-insert.
          sourceRefId: `${matchReport.id}:${idx}`,
          sourceTypeLabel: "Match report",
        })),
      );
    } catch (err) {
      console.error("Failed to persist KB entries from transcript:", err);
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/kb`);
  revalidatePath(`/projects/${projectId}/transcripts`);
  revalidatePath(`/projects/${projectId}/reports`);
  redirect(`/projects/${projectId}/reports/${matchReport.id}`);
}
