import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { ProjectAssistantChat } from "@/components/project-assistant-chat";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNavContext } from "@/lib/data";

export default async function AskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireDbUser();

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      members: { some: { userId: user.id } },
    },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  // Pull a slim view of the KB so [KB-N] tags from the model can be
  // rendered with hover titles on the client. Order matches what the
  // route handler uses (newest first), so indices line up.
  const [nav, kbEntries] = await Promise.all([
    getNavContext({ projectId }),
    db.knowledgeEntry.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        source: true,
        sourceTypeLabel: true,
        title: true,
      },
    }),
  ]);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{ id: project.id, name: project.name }}
    >
      <main
        className="wrap-w"
        style={{
          paddingBottom: 32,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PageHead
          eyebrow={`Ask GPR · ${project.name}`}
          title="Ask the project anything."
          sub={
            kbEntries.length === 0
              ? "Backed by the project brief only — no knowledge entries yet."
              : `Backed by the project brief and ${kbEntries.length} knowledge entr${kbEntries.length === 1 ? "y" : "ies"}.`
          }
        />
        <ProjectAssistantChat
          projectId={project.id}
          kbEntries={kbEntries}
        />
      </main>
    </AppShell>
  );
}
