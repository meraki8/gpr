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
type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
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
  updated: string;
  created: string;
  url: string;
  sprintNames: string[];
  sprintActiveName: string | null;
};

function authHeader(auth: JiraAuth): string {
  const raw = `${auth.email}:${auth.apiToken}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

function adfToPlainText(node: AdfNode | undefined | null): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  const childText = (node.content ?? []).map(adfToPlainText).join("");
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "listItem":
    case "blockquote":
    case "codeBlock":
      return `${childText}\n`;
    case "hardBreak":
      return "\n";
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

// Pulls every issue in the project. Paginates 100 at a time. ORDER
// BY updated DESC keeps the most recently changed issues first so
// Sync Now feels responsive even when the project is large.
export async function searchProjectIssues(
  auth: JiraAuth,
  projectKey: string,
): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  const pageSize = 100;
  // Hard cap so a misconfigured project can't burn the whole sync
  // budget — 1000 issues is plenty for a hackathon-scale workspace.
  const HARD_CAP = 1000;

  while (issues.length < HARD_CAP) {
    const url = new URL(`${auth.baseUrl}/rest/api/3/search`);
    url.searchParams.set("jql", `project = "${projectKey}" ORDER BY updated DESC`);
    url.searchParams.set("startAt", String(startAt));
    url.searchParams.set("maxResults", String(pageSize));
    url.searchParams.set(
      "fields",
      "summary,status,assignee,duedate,priority,description,updated,created,*all",
    );

    const res = await fetch(url, {
      headers: { ...HEADERS_BASE, Authorization: authHeader(auth) },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Jira search ${projectKey}: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as {
      issues?: RawIssue[];
      total?: number;
      maxResults?: number;
    };
    const page = (json.issues ?? []).map((i) => toJiraIssue(i, auth.baseUrl));
    issues.push(...page);
    if (page.length < pageSize) break;
    startAt += pageSize;
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
