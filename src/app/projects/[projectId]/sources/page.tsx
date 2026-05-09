import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups, getProjectSources } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import {
  addGithubRepo,
  removeGithubRepo,
  setGithubUsername,
  syncGithubSource,
  connectJira,
  disconnectJira,
  setJiraAccountId,
} from "./actions";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, allGroups, sources] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
    getProjectSources(projectId),
  ]);
  const { project, isOwner } = sources;

  if (!isOwner) notFound();

  const githubSource = project.contributionSources.find(
    (s) => s.sourceType === "GITHUB",
  );
  const githubRepos =
    (githubSource?.configJson as { repos?: string[] } | null)?.repos ?? [];

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
      groups={allGroups}
      currentProject={{
        id: project.id,
        name: project.name,
        group: { id: project.group.id, name: project.group.name },
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Sources · ${project.name}`}
          title="Contribution sources."
          sub="Hook GitHub up so commits and PRs feed into the ref's evidence pile. Owner only."
        />

        {/* GitHub */}
        <section
          style={{
            paddingBottom: 80,
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
              GitHub
            </h2>
            {githubSource && githubRepos.length > 0 && (
              <form action={syncGithubSource}>
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="pill pill-red">
                  Sync now →
                </button>
              </form>
            )}
          </div>
          {githubSource?.lastSyncedAt && (
            <p className="mute-ink" style={{ fontSize: 13, marginTop: -16, marginBottom: 32 }}>
              Last synced{" "}
              {githubSource.lastSyncedAt.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}

          <div className="label" style={{ marginBottom: 14 }}>
            Repos
          </div>
          {githubRepos.length === 0 ? (
            <p
              className="body mute-ink"
              style={{ margin: 0, marginBottom: 24 }}
            >
              No repos connected yet.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 24px 0",
                display: "grid",
                gap: 0,
              }}
            >
              {githubRepos.map((r) => (
                <li
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--line-2)",
                  }}
                >
                  <a
                    href={`https://github.com/${r}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="num lk"
                    style={{ fontSize: 14 }}
                  >
                    {r}
                  </a>
                  <form action={removeGithubRepo}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="repo" value={r} />
                    <button
                      type="submit"
                      className="lk-mute"
                      style={{ fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={addGithubRepo}
            style={{ display: "flex", gap: 10, maxWidth: 480 }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="text"
              name="repo"
              placeholder="owner/repo"
              required
              className="field num"
              style={{ flex: 1 }}
            />
            <button type="submit" className="pill pill-sm">
              Add →
            </button>
          </form>

          <div
            className="label"
            style={{ marginBottom: 14, marginTop: 56 }}
          >
            Member GitHub usernames
          </div>
          <p
            className="body mute-ink"
            style={{ margin: 0, marginBottom: 24, fontSize: 14 }}
          >
            Map each member to their GitHub login so commits get attributed
            to the right person.
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 0,
            }}
          >
            {project.members.map((m) => {
              const identity = m.sourceIdentities.find(
                (si) => si.sourceType === "GITHUB",
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
                    action={setGithubUsername}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input type="hidden" name="projectId" value={projectId} />
                    <input
                      type="hidden"
                      name="projectMemberId"
                      value={m.id}
                    />
                    <input
                      type="text"
                      name="externalId"
                      placeholder="github-login"
                      defaultValue={identity?.externalId ?? ""}
                      required
                      className="field num"
                      style={{ width: 200, padding: "8px 12px" }}
                    />
                    <button
                      type="submit"
                      className="pill pill-ghost pill-sm"
                    >
                      Save
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Jira */}
        <section
          style={{
            padding: "80px 0",
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

        {/* Recent activity */}
        <section style={{ padding: "80px 0 0" }}>
          <div className="label" style={{ marginBottom: 32 }}>
            Recent activity
          </div>
          {project.contributionEvents.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              No contribution events yet. Add a repo and Sync.
            </p>
          ) : (
            project.contributionEvents.map((e, i) => {
              const payload = e.payloadJson as {
                login?: string;
                message?: string;
                title?: string;
                url?: string;
                repo?: string;
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
                  <span
                    className="mute-ink num"
                    style={{ fontSize: 12 }}
                  >
                    {e.occurredAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span
                    className="label"
                    style={{ color: "var(--red)" }}
                  >
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
                    @{payload.login ?? "unknown"}
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
                    {payload.title ?? payload.message ?? "—"}
                  </a>
                </div>
              );
            })
          )}
        </section>
      </main>
    </AppShell>
  );
}
