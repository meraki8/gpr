import { AppShell } from "@/components/app-shell";
import { KnowledgeBaseExplorer } from "@/components/knowledge-base-explorer";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { checkContractGate, getNavContext, getProjectKb, type KbDateRangeKey } from "@/lib/data";
import { addManualKnowledgeEntry } from "./actions";

const VALID_RANGES: KbDateRangeKey[] = [
  "today",
  "7d",
  "30d",
  "3m",
  "all",
  "custom",
];

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function KnowledgeBasePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  
  await checkContractGate(projectId);

  const rawRange = firstParam(sp.range);
  const range: KbDateRangeKey =
    rawRange && (VALID_RANGES as string[]).includes(rawRange)
      ? (rawRange as KbDateRangeKey)
      : "all";
  const filters = {
    page: Number(firstParam(sp.page) ?? 1) || 1,
    range,
    customFrom: firstParam(sp.from) ?? null,
    customTo: firstParam(sp.to) ?? null,
    source: firstParam(sp.source) ?? null,
    q: firstParam(sp.q) ?? null,
  };

  const [user, nav, kb] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectKb(projectId, filters),
  ]);
  const {
    project,
    entries,
    totalCount,
    page,
    totalPages,
    pageSize,
    sourceCounts,
    sourceTotal,
    canAddManual,
    activeFilters,
  } = kb;

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{
        id: project.id,
        name: project.name,
        deadlineIso: project.deadline?.toISOString() ?? null,
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Knowledge base · ${project.name}`}
          title="What the project knows."
          sub={
            totalCount === 0
              ? "Nothing yet. Run a transcript analysis, sync GitHub, or add a note below."
              : `${totalCount} entr${totalCount === 1 ? "y" : "ies"} match. Search, filter, and click to read.`
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

        <KnowledgeBaseExplorer
          entries={entries}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          sourceCounts={sourceCounts}
          sourceTotal={sourceTotal}
          activeFilters={activeFilters}
        />
      </main>
    </AppShell>
  );
}
