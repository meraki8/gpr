import "server-only";

// Minimal Jira Cloud REST v3 client. Auth is HTTP Basic with the
// account email as the username and an Atlassian API token as the
// password. Tokens come from
// https://id.atlassian.com/manage-profile/security/api-tokens.

export type JiraAuth = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

// Description bodies are Atlassian Document Format (ADF). We only
// need plain text for the AC parser and Claude prompts, so the
// renderer here is intentionally minimal — concatenates text leaves
// and inserts newlines for paragraphs / list items / headings.
export type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
};

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  statusName: string;
  statusCategory: string;
  assigneeAccountId: string | null;
  assigneeDisplayName: string | null;
  dueDate: string | null;
  priority: string | null;
  description: string;
  descriptionAdf: AdfNode | null;
  updated: string;
  created: string;
  url: string;
  sprintNames: string[];
  sprintActiveName: string | null;
};

export type JiraStatusChange = {
  changedAt: string;
  fromStatus: string | null;
  toStatus: string;
};

function authHeader(auth: JiraAuth): string {
  const raw = `${auth.email}:${auth.apiToken}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

type AdfTaskNode = AdfNode & {
  attrs?: { state?: string };
};

function adfToPlainText(node: AdfNode | undefined | null): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  const childText = (node.content ?? []).map(adfToPlainText).join("");
  switch (node.type) {
    case "doc":
    case "bulletList":
    case "orderedList":
    case "taskList":
    case "panel":
    case "table":
      return childText;
    case "paragraph":
    case "heading":
    case "listItem":
    case "blockquote":
    case "codeBlock":
      return `${childText}\n`;
    case "tableRow":
      return `${childText}\n`;
    case "tableCell":
    case "tableHeader":
      return `${childText.trim()}\n`;
    case "hardBreak":
      return "\n";
    // Jira's native checklist UI emits taskList -> taskItem nodes
    // with state="DONE"|"TODO". Render them as `[x]` / `[ ]` so the
    // AC parser sees the same shape it does for typed checkboxes.
    case "taskItem": {
      const state = (node as AdfTaskNode).attrs?.state ?? "TODO";
      const box = state === "DONE" ? "[x]" : "[ ]";
      return `${box} ${childText.trim()}\n`;
    }
    default:
      return childText;
  }
}

type RawIssue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    assignee?: { accountId?: string; displayName?: string } | null;
    duedate?: string | null;
    priority?: { name?: string } | null;
    description?: AdfNode | null;
    updated?: string;
    created?: string;
    [customField: string]: unknown;
  };
};

type RawChangelog = {
  values?: {
    created?: string;
    items?: {
      field?: string;
      fieldId?: string;
      fromString?: string | null;
      toString?: string | null;
    }[];
  }[];
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
};

type RawTransition = {
  id?: string;
  name?: string;
  to?: {
    name?: string;
    statusCategory?: { key?: string };
  };
};

// Jira returns sprint info on a custom field whose ID varies per
// workspace (commonly customfield_10020). We sniff for any field
// whose value looks like a sprint array so we don't have to ask the
// user to configure the field ID.
function extractSprintNames(fields: RawIssue["fields"]): {
  names: string[];
  active: string | null;
} {
  const names: string[] = [];
  let active: string | null = null;
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        typeof (item as { name: unknown }).name === "string"
      ) {
        const name = (item as { name: string }).name;
        const state =
          "state" in item &&
          typeof (item as { state: unknown }).state === "string"
            ? (item as { state: string }).state.toLowerCase()
            : null;
        if (state === "active" || state === "closed" || state === "future") {
          names.push(name);
          if (state === "active" && !active) active = name;
        }
      }
    }
  }
  return { names, active };
}

function toJiraIssue(raw: RawIssue, baseUrl: string): JiraIssue {
  const sprint = extractSprintNames(raw.fields);
  return {
    id: raw.id,
    key: raw.key,
    summary: raw.fields.summary ?? "(no summary)",
    statusName: raw.fields.status?.name ?? "Unknown",
    statusCategory: raw.fields.status?.statusCategory?.key ?? "undefined",
    assigneeAccountId: raw.fields.assignee?.accountId ?? null,
    assigneeDisplayName: raw.fields.assignee?.displayName ?? null,
    dueDate: raw.fields.duedate ?? null,
    priority: raw.fields.priority?.name ?? null,
    description: adfToPlainText(raw.fields.description ?? null).trim(),
    descriptionAdf: raw.fields.description ?? null,
    updated: raw.fields.updated ?? new Date().toISOString(),
    created: raw.fields.created ?? new Date().toISOString(),
    url: `${baseUrl}/browse/${raw.key}`,
    sprintNames: sprint.names,
    sprintActiveName: sprint.active,
  };
}

const HEADERS_BASE: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "GPR/1.0",
};

function normalizeStatusName(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function transitionScore(
  transition: RawTransition,
  target: "in_progress" | "done",
): number {
  const toName = normalizeStatusName(transition.to?.name);
  const transitionName = normalizeStatusName(transition.name);
  const category = transition.to?.statusCategory?.key?.toLowerCase() ?? "";
  const combined = `${transitionName} ${toName}`;
  let score = 0;

  if (target === "done") {
    if (category === "done") score += 100;
    if (/^(done|complete|completed|closed|resolved)$/.test(toName)) score += 60;
    if (/(done|complete|close|resolve|finish)/.test(combined)) score += 25;
    return score;
  }

  if (/^(in progress|doing|development|in development)$/.test(toName)) {
    score += 100;
  }
  if (/(in progress|doing|development|start progress)/.test(combined)) {
    score += 50;
  }
  if (category === "indeterminate") score += 30;
  if (/(block|blocked|review|test|qa|done|complete|close|resolve)/.test(toName)) {
    score -= 80;
  }
  return score;
}

export type JiraTransitionResult =
  | {
      ok: true;
      transitionId: string;
      transitionName: string;
      toStatus: string;
    }
  | {
      ok: false;
      reason: string;
      availableTransitions: string[];
    };

async function fetchIssueTransitions(
  auth: JiraAuth,
  issueKey: string,
): Promise<RawTransition[]> {
  const res = await fetch(
    `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      headers: { ...HEADERS_BASE, Authorization: authHeader(auth) },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Jira transitions ${issueKey}: ${res.status} ${res.statusText} - ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { transitions?: RawTransition[] };
  return json.transitions ?? [];
}

export async function transitionIssueTo(
  auth: JiraAuth,
  issueKey: string,
  target: "in_progress" | "done",
): Promise<JiraTransitionResult> {
  let transitions: RawTransition[];
  try {
    transitions = await fetchIssueTransitions(auth, issueKey);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Could not load Jira transitions",
      availableTransitions: [],
    };
  }

  const availableTransitions = transitions.map((t) =>
    [t.name, t.to?.name].filter(Boolean).join(" -> "),
  );
  const ranked = transitions
    .filter((t): t is RawTransition & { id: string } => Boolean(t.id))
    .map((transition) => ({
      transition,
      score: transitionScore(transition, target),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.transition;
  if (!best) {
    return {
      ok: false,
      reason: `No available Jira workflow transition to ${target === "done" ? "Done" : "In Progress"}`,
      availableTransitions,
    };
  }

  const res = await fetch(
    `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      headers: {
        ...HEADERS_BASE,
        Authorization: authHeader(auth),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transition: { id: best.id } }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      reason: `Jira transition ${issueKey}: ${res.status} ${res.statusText} - ${text.slice(0, 300)}`,
      availableTransitions,
    };
  }

  return {
    ok: true,
    transitionId: best.id,
    transitionName: best.name ?? best.id,
    toStatus: best.to?.name ?? "",
  };
}

function markUncheckedBoxesDoneInText(text: string): string {
  return text.replace(/\[\s\]/g, "[x]");
}

function markAdfTasksDone(node: AdfNode): { node: AdfNode; changed: boolean } {
  let changed = false;
  const next: AdfNode = { ...node };

  if (typeof node.text === "string") {
    const text = markUncheckedBoxesDoneInText(node.text);
    if (text !== node.text) {
      next.text = text;
      changed = true;
    }
  }

  if (node.type === "taskItem") {
    const attrs = { ...(node.attrs ?? {}) };
    if (attrs.state !== "DONE") {
      attrs.state = "DONE";
      next.attrs = attrs;
      changed = true;
    }
  }

  if (Array.isArray(node.content)) {
    const content = node.content.map((child) => {
      const result = markAdfTasksDone(child);
      if (result.changed) changed = true;
      return result.node;
    });
    next.content = content;
  }

  return { node: next, changed };
}

export async function markIssueDescriptionTasksDone(
  auth: JiraAuth,
  issueKey: string,
  description: AdfNode | null,
): Promise<{ ok: boolean; updated: boolean; reason?: string }> {
  if (!description) {
    return { ok: true, updated: false, reason: "Issue has no description" };
  }

  const result = markAdfTasksDone(description);
  if (!result.changed) {
    return { ok: true, updated: false, reason: "No unchecked checklist items found" };
  }

  const res = await fetch(
    `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      method: "PUT",
      headers: {
        ...HEADERS_BASE,
        Authorization: authHeader(auth),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { description: result.node } }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      updated: false,
      reason: `Jira description update ${issueKey}: ${res.status} ${res.statusText} - ${text.slice(0, 300)}`,
    };
  }

  return { ok: true, updated: true };
}

// Pulls every issue in the project via the new /rest/api/3/search/jql
// endpoint. The legacy /rest/api/3/search was retired in 2025
// (Atlassian CHANGE-2046). Pagination is now token-based: the
// response carries `nextPageToken` and `isLast` instead of
// startAt/total.
export async function searchProjectIssues(
  auth: JiraAuth,
  projectKey: string,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  // Hard cap so a misconfigured project can't burn the whole sync
  // budget — 1000 issues is plenty for a hackathon-scale workspace.
  const HARD_CAP = 1000;
  let nextPageToken: string | undefined;

  // The new endpoint requires fields as an array. "*all" still
  // works and is needed to pick up the sprint custom field whose
  // ID varies per workspace.
  const fields = ["*all"];

  while (issues.length < HARD_CAP) {
    const body: Record<string, unknown> = {
      jql: `project = "${projectKey}" ORDER BY updated DESC`,
      fields,
      maxResults: 100,
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(`${auth.baseUrl}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        ...HEADERS_BASE,
        Authorization: authHeader(auth),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Jira search ${projectKey}: ${res.status} ${res.statusText} — ${text.slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as {
      issues?: RawIssue[];
      nextPageToken?: string;
      isLast?: boolean;
    };
    const page = (json.issues ?? []).map((i) => toJiraIssue(i, auth.baseUrl));
    issues.push(...page);

    if (json.isLast || !json.nextPageToken) break;
    nextPageToken = json.nextPageToken;
  }

  return issues;
}

// Fetches the most recent comments on an issue so the AC judge can
// look for human evidence ("PR #123 fixes this", screenshots, etc.).
export async function fetchIssueComments(
  auth: JiraAuth,
  issueKey: string,
  limit = 10,
): Promise<string[]> {
  const url = new URL(
    `${auth.baseUrl}/rest/api/3/issue/${issueKey}/comment?orderBy=-created&maxResults=${limit}`,
  );
  const res = await fetch(url, {
    headers: { ...HEADERS_BASE, Authorization: authHeader(auth) },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { comments?: { body?: AdfNode }[] };
  return (json.comments ?? [])
    .map((c) => adfToPlainText(c.body).trim())
    .filter((s) => s.length > 0);
}

export async function fetchIssueStatusChanges(
  auth: JiraAuth,
  issueKey: string,
  limit = 20,
): Promise<JiraStatusChange[]> {
  const changes: JiraStatusChange[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (changes.length < limit) {
    const url = new URL(
      `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog`,
    );
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(maxResults));

    const res = await fetch(url, {
      headers: { ...HEADERS_BASE, Authorization: authHeader(auth) },
      cache: "no-store",
    });
    if (!res.ok) return changes;

    const json = (await res.json()) as RawChangelog;
    const values = json.values ?? [];
    for (const history of values) {
      for (const item of history.items ?? []) {
        if (item.field !== "status" && item.fieldId !== "status") continue;
        if (!history.created || !item.toString) continue;
        changes.push({
          changedAt: history.created,
          fromStatus: item.fromString ?? null,
          toStatus: item.toString,
        });
        if (changes.length >= limit) break;
      }
      if (changes.length >= limit) break;
    }

    const nextStart = startAt + (json.maxResults ?? maxResults);
    if (json.isLast || nextStart >= (json.total ?? nextStart)) break;
    startAt = nextStart;
  }

  return changes.sort(
    (a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt),
  );
}
