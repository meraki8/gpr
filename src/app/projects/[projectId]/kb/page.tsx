import { AppShell } from "@/components/app-shell";
import { KnowledgeBaseExplorer } from "@/components/knowledge-base-explorer";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { checkContractGate, getNavContext, getProjectKb } from "@/lib/data";
import { addManualKnowledgeEntry } from "./actions";

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await checkContractGate(projectId);
  const [user, nav, { project, entries, canAddManual }] =
    await Promise.all([
      requireDbUser(),
      getNavContext({ projectId }),
      getProjectKb(projectId),
    ]);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{ id: project.id, name: project.name }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Knowledge base · ${project.name}`}
          title="What the project knows."
          sub={
            entries.length === 0
              ? "Nothing yet. Run a transcript analysis, sync GitHub, or add a note below."
              : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}. Search, filter, and click to read.`
          }
        />

        {canAddManual && (
          <section style={{ paddingBottom: 56, maxWidth: 760 }}>
            <div className="label" style={{ marginBottom: 18 }}>
              Add a note
            </div>
            <form
              action={addManualKnowledgeEntry}
              style={{ display: "grid", gap: 12 }}
            >
              <input type="hidden" name="projectId" value={project.id} />
              <input
                type="text"
                name="title"
                placeholder="Title — what's this about?"
                required
                maxLength={280}
                className="field"
              />
              <textarea
                name="content"
                placeholder="Decision, scope change, side context, link to a doc — anything future-you would want the AI to remember."
                required
                rows={4}
                className="field field-lg"
              />
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  name="label"
                  placeholder="Label (optional) — e.g. Decision, Risk"
                  maxLength={60}
                  className="field"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="pill pill-sm">
                  Save →
                </button>
              </div>
            </form>
          </section>
        )}

        <KnowledgeBaseExplorer entries={entries} />
      </main>
    </AppShell>
  );
}
