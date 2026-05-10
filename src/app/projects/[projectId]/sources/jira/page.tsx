import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { checkContractGate, getNavContext, getProjectSources } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import {
  connectJira,
  disconnectJira,
  setJiraAccountId,
  syncJiraSource,
} from "../actions";

type JiraConfig = {
  projectKey?: string;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  webhookSecret?: string;
};

type AcJudgement = {
  acText: string;
  selfReportedDone: boolean | null;
  aiThinksDone: boolean;
  reason: string;
};

type JiraActivityPayload = {
  issueId?: string;
  title?: string;
  issueKey?: string;
  assigneeDisplayName?: string;
  url?: string;
  status?: string;
  previousStatus?: string;
  acHasAc?: boolean;
  acAllMet?: boolean;
  acSummary?: string;
  acJudgements?: AcJudgement[];
};

function maskToken(token: string | undefined): string {
  if (!token) return "—";
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  issue_created: { label: "created", color: "var(--mute)" },
  issue_updated: { label: "updated", color: "var(--ink)" },
  issue_completed: { label: "completed", color: "#10b981" },
  issue_completed_ac_failed: { label: "done · AC failed", color: "var(--red)" },
  issue_overdue: { label: "overdue", color: "var(--red)" },
  issue_stale: { label: "stale", color: "var(--mute-2)" },
};

function isCompletedEvent(eventType: string): boolean {
  return (
    eventType === "issue_completed" ||
    eventType === "issue_completed_ac_failed"
  );
}

function isDoneStatus(status: string | undefined): boolean {
  return /^(done|complete|completed|closed|resolved)$/i.test(
    status?.trim() ?? "",
  );
}

function activityIssueKey(payload: JiraActivityPayload): string | null {
  return payload.issueId ?? payload.issueKey ?? payload.title ?? null;
}

export default async function JiraPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);
  await checkContractGate(projectId);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const [user, nav, sources] = await Promise.all([
    requireDbUser(),
    getNavContext({ projectId }),
    getProjectSources(projectId, page, "JIRA"),
  ]);
  const { project, contributionEvents, isOwner, hasNextPage } = sources;
  const visibleJiraEvents = contributionEvents.filter((event) => {
    if (event.eventType !== "issue_updated") return true;
    const payload = event.payloadJson as JiraActivityPayload;
    if (!payload.previousStatus || !isDoneStatus(payload.status)) return true;

    const issueKey = activityIssueKey(payload);
    if (!issueKey) return true;

    return !contributionEvents.some((other) => {
      if (other.id === event.id || !isCompletedEvent(other.eventType)) {
        return false;
      }
      const otherPayload = other.payloadJson as JiraActivityPayload;
      if (activityIssueKey(otherPayload) !== issueKey) return false;
      return (
        Math.abs(other.occurredAt.getTime() - event.occurredAt.getTime()) <
        2 * 60 * 1000
      );
    });
  });

  const jiraSource = project.contributionSources.find(
    (s) => s.sourceType === "JIRA",
  );
  const jiraConfig = (jiraSource?.configJson as JiraConfig | null) ?? null;
  const isConnectedWithApi = Boolean(
    jiraConfig?.baseUrl && jiraConfig?.email && jiraConfig?.apiToken,
  );

  const webhookUrl =
    jiraSource && jiraConfig?.webhookSecret
      ? `${getBaseUrl()}/api/webhooks/jira?projectId=${projectId}&secret=${jiraConfig.webhookSecret}`
      : null;

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
          eyebrow={`Jira · ${project.name}`}
          title="Jira board."
          sub="GPR pulls your Jira issues, watches for status transitions, overdue tickets and acceptance-criteria misses, and updates the leaderboard automatically."
        />

        <section
          style={{
            padding: "0 0 24px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {isConnectedWithApi && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <form action={syncJiraSource}>
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="pill pill-red">
                  Sync now
                </button>
              </form>
            </div>
          )}

          {jiraSource?.lastSyncedAt && (
            <p className="mute-ink" style={{ fontSize: 13, marginTop: -16, marginBottom: 32 }}>
              Last synced{" "}
              {jiraSource.lastSyncedAt.toLocaleString("en-NZ", {
                timeZone: "Pacific/Auckland",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          )}

          {!isConnectedWithApi ? (
            <>
              <p className="body mute-ink" style={{ marginBottom: 32, fontSize: 14 }}>
                Connect your Jira project with an Atlassian API token. GPR pulls
                issues directly — no setup required. Generate a token at{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lk"
                >
                  id.atlassian.com → Security → API tokens
                </a>
                .
              </p>
              <form
                action={connectJira}
                style={{ display: "grid", gap: 14, maxWidth: 820 }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>Jira workspace URL</div>
                  <input
                    type="url"
                    name="jiraBaseUrl"
                    placeholder="https://yourorg.atlassian.net/jira/software/projects/yourprojectkey/boards/100"
                    defaultValue={jiraConfig?.baseUrl ?? ""}
                    required
                    className="field"
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <div className="label" style={{ marginBottom: 8 }}>Project key</div>
                    <input
                      type="text"
                      name="jiraProjectKey"
                      placeholder="GPR"
                      defaultValue={jiraConfig?.projectKey ?? ""}
                      required
                      className="field num"
                      style={{ width: "100%", textTransform: "uppercase" }}
                    />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 8 }}>Atlassian email</div>
                    <input
                      type="email"
                      name="jiraEmail"
                      placeholder="you@example.com"
                      defaultValue={jiraConfig?.email ?? ""}
                      required
                      className="field"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 8 }}>API token</div>
                  <input
                    type="password"
                    name="jiraApiToken"
                    placeholder="Paste your Atlassian API token"
                    required
                    className="field num"
                    style={{ width: "100%" }}
                  />
                  <p className="mute-ink" style={{ fontSize: 12, marginTop: 6 }}>
                    Stored per-project. Used for issue sync and Jira workflow updates.
                  </p>
                </div>
                <button type="submit" className="pill pill-sm" style={{ justifySelf: "start" }}>
                  Connect →
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 24, marginBottom: 48 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Project key</div>
                    <span className="num" style={{ fontSize: 15 }}>{jiraConfig?.projectKey}</span>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Workspace</div>
                    <a
                      href={jiraConfig?.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lk-mute num"
                      style={{ fontSize: 13 }}
                    >
                      {jiraConfig?.baseUrl?.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>API token</div>
                    <span className="num mute-ink" style={{ fontSize: 13 }}>
                      {maskToken(jiraConfig?.apiToken)}
                    </span>
                  </div>
                  {isOwner && jiraSource && (
                    <form action={disconnectJira} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <button type="submit" className="lk-mute" style={{ fontSize: 12 }}>
                        Disconnect workspace
                      </button>
                    </form>
                  )}
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 8 }}>
                    Acceptance criteria format
                  </div>
                  <p className="body mute-ink" style={{ fontSize: 13, margin: 0, marginBottom: 10 }}>
                    Put your Acceptance Criteria in the Description field of your user stories.
                    A format like below works well. When the issue moves to Done, GPR
                    judges each criterion against GitHub code evidence. Misses become
                    yellow cards.
                  </p>
                  <pre
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "12px 14px",
                      fontFamily: "monospace",
                      fontSize: 12,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      color: "var(--ink)",
                    }}
                  >{`## Acceptance Criteria
[ ] User can sign in with email + password
[x] Invalid credentials show an error
[ ] Session persists for 7 days`}</pre>
                </div>
              </div>

              <div className="label" style={{ marginBottom: 14 }}>
                Member Jira account IDs
              </div>
              <p className="body mute-ink" style={{ fontSize: 14, marginBottom: 24, marginTop: 0 }}>
                Map each member to their Jira account ID so events get attributed correctly.
                Find it in Jira: profile → Account ID (a long string like <code style={{ fontSize: 12 }}>712020:7ab3afb2-5b06-42e6-89ee-9a8f619aa167</code>).
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
                        gap: 18,
                        padding: "12px 0",
                        borderBottom: "1px solid var(--line-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ width: 260, maxWidth: "100%" }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                          {m.user.name ?? m.user.email}
                        </div>
                        <div className="mute-ink" style={{ fontSize: 13 }}>
                          {m.user.email}
                        </div>
                      </div>
                      {isOwner ? (
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
                            style={{ width: 360, maxWidth: "100%", padding: "8px 12px" }}
                          />
                          <button type="submit" className="pill pill-ghost pill-sm">
                            Save
                          </button>
                        </form>
                      ) : (
                        <span className="num mute-ink" style={{ fontSize: 13 }}>
                          {identity?.externalId ?? "—"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {webhookUrl && (
                <details style={{ marginTop: 14 }}>
                  <summary
                    className="lk-mute"
                    style={{ fontSize: 12, cursor: "pointer" }}
                  >
                    Advanced: Make.com webhook (legacy fallback)
                  </summary>
                  <p className="body mute-ink" style={{ fontSize: 13, margin: "8px 0 0" }}>
                    Most users should ignore this — the API token connection above
                    handles everything. The webhook endpoint is here for users who
                    already have a Make.com scenario configured.
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
                      marginTop: 6,
                    }}
                  >
                    {webhookUrl}
                  </div>
                </details>
              )}
            </>
          )}
        </section>

        {/* Recent Jira activity */}
        <section style={{ padding: "48px 0 0" }}>
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
          {visibleJiraEvents.length === 0 ? (
            <p className="body mute-ink" style={{ margin: 0 }}>
              {page > 1
                ? "No more events."
                : isConnectedWithApi
                  ? "No Jira events yet. Click “Sync now” to pull issues from Jira."
                  : "No Jira events yet. Connect Jira above to start syncing."}
            </p>
          ) : (
            visibleJiraEvents.map((e, i) => {
              const payload = e.payloadJson as JiraActivityPayload;
              const meta = EVENT_LABELS[e.eventType] ?? {
                label: e.eventType,
                color: "var(--mute)",
              };
              const showAc = isCompletedEvent(e.eventType);
              const acJudgements = (payload.acJudgements ?? []).filter(
                (j) => j.acText.trim().length > 0,
              );
              const hasAcPayload =
                typeof payload.acHasAc === "boolean" ||
                typeof payload.acAllMet === "boolean" ||
                typeof payload.acSummary === "string" ||
                (payload.acJudgements?.length ?? 0) > 0;
              const acHasAc =
                payload.acHasAc === true ||
                (payload.acHasAc !== false && acJudgements.length > 0);
              const acAllMet =
                acHasAc &&
                (typeof payload.acAllMet === "boolean"
                  ? payload.acAllMet
                  : acJudgements.length > 0 &&
                    acJudgements.every((j) => j.aiThinksDone));
              const acSummary =
                payload.acSummary ??
                (hasAcPayload
                  ? "No acceptance criteria were found for this ticket."
                  : "AC has not been judged with code evidence yet. Sync Jira to run the current judge.");
              const eventMeta = showAc
                ? acAllMet
                  ? { label: "completed", color: "#10b981" }
                  : hasAcPayload && acHasAc
                    ? { label: "done · AC failed", color: "var(--red)" }
                    : { label: "completed", color: "#10b981" }
                : meta;
              return (
                <div
                  key={e.id}
                  className="fade-up"
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid var(--line-2)",
                    animationDelay: `${i * 24}ms`,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 140px 160px 1fr",
                      gap: 24,
                      alignItems: "baseline",
                    }}
                  >
                    <span className="mute-ink num" style={{ fontSize: 12 }}>
                      {e.occurredAt.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="label" style={{ color: eventMeta.color }}>
                      {eventMeta.label}
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
                  {e.eventType === "issue_updated" && payload.previousStatus && (
                    <div
                      className="mute-ink"
                      style={{ fontSize: 12, marginTop: 6, paddingLeft: 124 }}
                    >
                      {payload.previousStatus} → {payload.status}
                    </div>
                  )}
                  {showAc && (
                    <div style={{ marginTop: 12, paddingLeft: 124 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: acAllMet
                            ? "#10b981"
                            : hasAcPayload && acHasAc
                              ? "var(--red)"
                              : "var(--mute)",
                          marginBottom: 8,
                          fontWeight: 500,
                        }}
                      >
                        {acAllMet
                          ? "✓ All AC met"
                          : hasAcPayload && acHasAc
                            ? "⚠ AC not met"
                            : hasAcPayload
                              ? "No AC found"
                            : "AC not judged"}{" "}
                        — {acSummary}
                      </div>
                      {acJudgements.length > 0 && (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
                          {acJudgements.map((j, idx) => (
                            <li
                              key={idx}
                              style={{
                                fontSize: 12,
                                color: j.aiThinksDone ? "var(--ink)" : "var(--red)",
                                display: "flex",
                                gap: 8,
                                alignItems: "baseline",
                                background: "transparent",
                              }}
                            >
                              <span
                                aria-label={j.aiThinksDone ? "Met" : "Unmet"}
                                style={{
                                  color: j.aiThinksDone ? "#10b981" : "var(--red)",
                                  fontWeight: 700,
                                  width: 14,
                                  flex: "0 0 14px",
                                  textAlign: "center",
                                }}
                              >
                                {j.aiThinksDone ? "✓" : "✕"}
                              </span>
                              <span style={{ flex: 1 }}>
                                {j.acText}
                                <div className="mute-ink" style={{ fontSize: 11, marginTop: 2 }}>
                                  {j.reason}
                                </div>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(page > 1 || hasNextPage) && (
            <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
              {page > 1 && (
                <Link
                  href={`/projects/${projectId}/sources/jira?page=${page - 1}`}
                  className="pill pill-ghost pill-sm"
                  style={{ textDecoration: "none" }}
                >
                  ← Newer
                </Link>
              )}
              {hasNextPage && (
                <Link
                  href={`/projects/${projectId}/sources/jira?page=${page + 1}`}
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
