import { NextRequest, NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderContractPdf } from "@/lib/contract-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const user = await requireDbUser();

  const contract = await db.contract.findUnique({
    where: { projectId },
    include: {
      project: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      signatures: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "No contract found" }, { status: 404 });
  }

  const isMember = contract.project.members.some((m) => m.userId === user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = contract.project.members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email,
    role: m.role,
  }));

  const signatures = contract.signatures.map((s) => ({
    userId: s.userId,
    userName: s.user.name ?? s.user.email,
    signedAt: s.signedAt.toISOString(),
  }));

  const deadline = contract.project.deadline
    ? contract.project.deadline.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const pdfBuffer = await renderContractPdf({
    projectName: contract.project.name,
    deadline,
    content: contract.content,
    members,
    signatures,
    generatedAt: new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  });

  const filename = `${contract.project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-contract.pdf`;

  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
