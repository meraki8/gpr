import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectSources } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import {
  connectJira,
  disconnectJira,
  setJiraAccountId,
} from "../sources/actions";

export default async function JiraPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [user, nav, sources] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectSources(projectId, page, "JIRA"),
  ]);
  const { project, hasNextPage } = sources;

  const jiraSource = project.contributionSources.find(
    (s) => s.sourceType === "JIRA",
  );
  const jiraConfig = jiraSource?.configJson as {
    projectKey?: string;
    boardUrl?: string;
    webhookSecret?: string;
  } | null;
  const webhookUrl = jiraSource
    ? `${getBaseUrl()}/api/webhooks/jira?projectId=${projectId}&secret=${jiraConfig?.webhookSecret ?? ""}`
    : null;

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
          eyebrow={`Jira · ${project.name}`}
          title="Jira board."
          sub="Connect Jira via Make.com so overdue or stale tickets fire events into the ref's evidence pile."
        />

        <section
          style={{
            padding: "0 0 80px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 32,
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <h2 className="h-m" style={{ margin: 0 }}>
              Jira
            </h2>
            {jiraSource && (
              <form action={disconnectJira}>
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="lk-mute" style={{ fontSize: 12 }}>
                  Disconnect
                </button>
              </form>
            )}
          </div>

          {!jiraSource ? (
            <>
              <p className="body mute-ink" style={{ marginBottom: 32, fontSize: 14 }}>
                Connect your Jira board. GPR will generate a webhook URL you paste into Make.com — Make.com watches Jira and fires events to GPR automatically.
              </p>
              <form
                action={connectJira}
                style={{ display: "grid", gap: 12, maxWidth: 480 }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Jira project key</div>
                  <input
                    type="text"
                    name="jiraProjectKey"
                    placeholder="e.g. GPR"
                    required
                    className="field num"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Jira board URL</div>
                  <input
                    type="url"
                    name="jiraBoardUrl"
                    placeholder="https://yourorg.atlassian.net/jira/software/projects/GPR/boards/1"
                    required
                    className="field"
                    style={{ width: "100%" }}
                  />
                </div>
                <button type="submit" className="pill pill-sm" style={{ justifySelf: "start" }}>
                  Connect →
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 24, marginBottom: 48 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Project key</div>
                  <span className="num" style={{ fontSize: 15 }}>{jiraConfig?.projectKey}</span>
                  {jiraConfig?.boardUrl && (
                    <a
                      href={jiraConfig.boardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lk-mute"
                      style={{ marginLeft: 16, fontSize: 13 }}
                    >
                      Open board ↗
                    </a>
                  )}
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 8 }}>
                    Make.com webhook URL
                  </div>
                  <p className="body mute-ink" style={{ fontSize: 13, marginBottom: 10, marginTop: 0 }}>
                    Paste this into Make.com's HTTP module. In Make.com: Jira trigger → HTTP (POST) → map{" "}
                    <code style={{ fontSize: 12 }}>event_type</code>,{" "}
                    <code style={{ fontSize: 12 }}>issue_key</code>,{" "}
                    <code style={{ fontSize: 12 }}>issue_id</code>,{" "}
                    <code style={{ fontSize: 12 }}>summary</code>,{" "}
                    <code style={{ fontSize: 12 }}>status</code>,{" "}
                    <code style={{ fontSize: 12 }}>assignee_account_id</code>,{" "}
                    <code style={{ fontSize: 12 }}>due_date</code>,{" "}
                    <code style={{ fontSize: 12 }}>url</code>.
                  </p>
                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "10px 14px",
                      fontFamily: "monospace",
                      fontSize: 12,
                      wordBreak: "break-all",
                      color: "var(--ink)",
                    }}
                  >
                    {webhookUrl}
                  </div>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 8 }}>
                    Supported event_type values
                  </div>
                  <ul className="body mute-ink" style={{ fontSize: 13, margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                    <li><code style={{ fontSize: 12 }}>issue_created</code> — new ticket</li>
                    <li><code style={{ fontSize: 12 }}>issue_updated</code> — status or assignee changed</li>
                    <li><code style={{ fontSize: 12 }}>issue_completed</code> — ticket resolved/done</li>
                    <li><code style={{ fontSize: 12 }}>issue_overdue</code> — past due date → auto yellow card</li>
                    <li><code style={{ fontSize: 12 }}>issue_stale</code> — no activity for X days</li>
                  </ul>
                </div>
              </div>

              <div className="label" style={{ marginBottom: 14 }}>
                Member Jira account IDs
              </div>
              <p className="body mute-ink" style={{ fontSize: 14, marginBottom: 24, marginTop: 0 }}>
                Map each member to their Jira account ID so events get attributed correctly.
                Find it in Jira: profile → Account ID (a long string like <code style={{ fontSize: 12 }}>abc123def456</code>).
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {project.members.map((m) => {
                  const identity = m.sourceIdentities.find(
                    (si) => si.sourceType === "JIRA",
                  );
                  return (
                    <li
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "16px 0",
                        borderBottom: "1px solid var(--line-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                          {m.user.name ?? m.user.email}
                        </div>
                        <div className="mute-ink" style={{ fontSize: 13 }}>
                          {m.user.email}
                        </div>
                      </div>
                      <form
                        action={setJiraAccountId}
                        style={{ display: "flex", gap: 8, alignItems: "center" }}
                      >
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="projectMemberId" value={m.id} />
                        <input
                          type="text"
                          name="externalId"
                          placeholder="accountId"
                          defaultValue={identity?.externalId ?? ""}
                          required
                          className="field num"
                          style={{ width: 220, padding: "8px 12px" }}
                        />
                        <button type="submit" className="pill pill-ghost pill-sm">
                          Save
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {/* Recent Jira activity */}
        <section style={{ padding: "80px 0 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 32,
            }}
          >
            <div className="label">Recent Jira activity</div>
            {(page > 1 || hasNextPage) && (
              <span className="mute-ink" style={{ fontSize: 12 }}>
                Page {page}
              </span>
            )}
          </div>
          {project.contributionEvents.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              {page > 1 ? "No more events." : "No Jira events yet. Connect a Jira board and run the Make.com scenario."}
            </p>
          ) : (
            project.contributionEvents.map((e, i) => {
              const payload = e.payloadJson as {
                title?: string;
                issueKey?: string;
                assigneeDisplayName?: string;
                url?: string;
              };
              return (
                <div
                  key={e.id}
                  className="fade-up"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 100px 160px 1fr",
                    gap: 32,
                    padding: "16px 0",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "baseline",
                    animationDelay: `${i * 24}ms`,
                  }}
                >
                  <span className="mute-ink num" style={{ fontSize: 12 }}>
                    {e.occurredAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="label" style={{ color: "var(--red)" }}>
                    {e.eventType}
                  </span>
                  <span
                    className="num"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {payload.assigneeDisplayName ?? "unassigned"}
                  </span>
                  <a
                    href={payload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lk-mute"
                    style={{
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {payload.title ?? payload.issueKey ?? "—"}
                  </a>
                </div>
              );
            })
          )}

          {(page > 1 || hasNextPage) && (
            <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
              {page > 1 && (
                <Link
                  href={`/projects/${projectId}/jira?page=${page - 1}`}
                  className="pill pill-ghost pill-sm"
                  style={{ textDecoration: "none" }}
                >
                  ← Newer
                </Link>
              )}
              {hasNextPage && (
                <Link
                  href={`/projects/${projectId}/jira?page=${page + 1}`}
                  className="pill pill-ghost pill-sm"
                  style={{ textDecoration: "none" }}
                >
                  Older →
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
