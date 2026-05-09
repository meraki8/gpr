import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Slim KB listing for the chat panel: gives the panel just enough
// info to resolve [KB-N] tags from the streamed model output back to
// titles + source colors. Order MUST match the ordering used by the
// /ask route handler so indices line up.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const user = await requireDbUser();

  const member = await db.projectMember.findFirst({
    where: {
      projectId,
      userId: user.id,
      project: { deletedAt: null },
    },
    select: { id: true },
  });
  if (!member) {
    return new Response(null, { status: 403 });
  }

  const entries = await db.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      source: true,
      sourceTypeLabel: true,
      title: true,
    },
  });

  return Response.json({ entries });
}
