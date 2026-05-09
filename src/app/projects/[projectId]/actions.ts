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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendInviteEmail({
    to: email,
    inviterName: user.name ?? user.email,
    projectName: project.name,
    projectBrief: project.brief,
    inviteUrl: `${appUrl}/invite/${token}`,
  });

  revalidatePath(`/projects/${projectId}`);
}

const TranscriptSchema = z.object({
  projectId: z.string().min(1),
  rawText: z
    .string()
    .trim()
    .min(20, "Transcript looks too short to analyze"),
});

export async function analyzeTranscript(formData: FormData) {
  const user = await requireDbUser();

  const parsed = TranscriptSchema.safeParse({
    projectId: formData.get("projectId"),
    rawText: formData.get("rawText"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { projectId, rawText } = parsed.data;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
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
      source: "PASTE",
    },
  });

  // 2. Build the system prompt with project + member context.
  const memberLines = project.members
    .map(
      (m) =>
        `- userId: "${m.user.id}", name: "${m.user.name ?? m.user.email}"`,
    )
    .join("\n");

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
    "",
    "PROJECT:",
    `Name: ${project.name}`,
    `Brief: ${project.brief}`,
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
  const matchReport = await db.matchReport.create({
    data: {
      projectId,
      transcriptId: transcript.id,
      summary: analysis.summary,
      periodStart: now,
      periodEnd: now,
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

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/reports/${matchReport.id}`);
}
