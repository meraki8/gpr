import "server-only";

// Minimal GitHub REST client for public repos. Unauthenticated requests
// have a 60 req/h per-IP rate limit — fine for a hackathon's manual sync.
// For private repos or higher throughput, add a GitHub PAT to the headers.

export type GhCommit = {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string } | null;
    message: string;
  };
  author: { login: string } | null;
  html_url: string;
};

export type GhPullRequest = {
  number: number;
  title: string;
  state: "open" | "closed";
  merged_at: string | null;
  user: { login: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
};

export type GhCodeEvidence = {
  repo: string;
  path: string;
  url: string;
  content: string;
};

export type GhChangedFile = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  blob_url?: string;
  raw_url?: string;
};

const HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "GPR/1.0",
};

function githubHeaders(accessToken?: string): HeadersInit {
  const token = accessToken || process.env.GITHUB_TOKEN;
  return token ? { ...HEADERS, Authorization: `Bearer ${token}` } : HEADERS;
}

function githubRawHeaders(accessToken?: string): HeadersInit {
  const token = accessToken || process.env.GITHUB_TOKEN;
  return token ? { "User-Agent": "GPR/1.0", Authorization: `Bearer ${token}` } : { "User-Agent": "GPR/1.0" };
}

export async function fetchCommits(
  owner: string,
  repo: string,
  since?: Date,
  accessToken?: string,
): Promise<GhCommit[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("per_page", "100");
  if (since) url.searchParams.set("since", since.toISOString());

  const res = await fetch(url, { headers: githubHeaders(accessToken), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub commits ${owner}/${repo}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as GhCommit[];
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
  accessToken?: string,
): Promise<GhPullRequest[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "all");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "50");

  const res = await fetch(url, { headers: githubHeaders(accessToken), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub PRs ${owner}/${repo}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as GhPullRequest[];
}

export async function fetchCommitFiles(
  owner: string,
  repo: string,
  sha: string,
  accessToken?: string,
): Promise<GhChangedFile[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`);
  const res = await fetch(url, { headers: githubHeaders(accessToken), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub commit ${owner}/${repo}@${sha.slice(0, 7)}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { files?: GhChangedFile[] };
  return json.files ?? [];
}

export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  accessToken?: string,
): Promise<GhChangedFile[]> {
  const files: GhChangedFile[] = [];
  let page = 1;
  while (page <= 3) {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url, { headers: githubHeaders(accessToken), cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `GitHub PR files ${owner}/${repo}#${pullNumber}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
      );
    }
    const batch = (await res.json()) as GhChangedFile[];
    files.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return files;
}

type GhRepoMeta = {
  default_branch?: string;
};

type GhTree = {
  tree?: {
    path?: string;
    type?: string;
    size?: number;
  }[];
};

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".md",
  ".json",
  ".vue",
  ".svelte",
  ".py",
  ".rb",
  ".go",
  ".java",
  ".cs",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "onto",
  "page",
  "button",
  "user",
  "can",
  "shows",
  "show",
  "appears",
  "appear",
  "loads",
  "load",
]);

function extensionOf(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "" : path.slice(idx).toLowerCase();
}

function isUsefulCodePath(path: string, size = 0): boolean {
  if (size > 80_000) return false;
  if (!CODE_EXTENSIONS.has(extensionOf(path))) return false;
  if (
    /(^|\/)(node_modules|\.next|dist|build|coverage|\.git|generated)(\/|$)/.test(
      path,
    )
  ) {
    return false;
  }
  if (/(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(path)) {
    return false;
  }
  if (/\.(map|min\.js)$/.test(path)) return false;
  return true;
}

function queryTermsFrom(texts: string[]): string[] {
  const terms = new Set<string>();
  for (const text of texts) {
    for (const raw of text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []) {
      const term = raw.replace(/^-+|-+$/g, "");
      if (!term || STOP_WORDS.has(term)) continue;
      terms.add(term);
    }
  }
  return [...terms].slice(0, 20);
}

function scorePath(path: string, terms: string[]): number {
  const lower = path.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 6;
  }
  if (/(^|\/)(src\/)?app\/page\.(tsx|ts|jsx|js)$/.test(lower)) score += 12;
  if (/(^|\/)(src\/)?pages\/index\.(tsx|ts|jsx|js)$/.test(lower)) score += 12;
  if (/(^|\/)(src\/)?app\/layout\.(tsx|ts|jsx|js)$/.test(lower)) score += 5;
  if (/(^|\/)(src\/)?app\/.+\/page\.(tsx|ts|jsx|js)$/.test(lower)) score += 4;
  if (/(^|\/)components\//.test(lower)) score += 3;
  if (/(^|\/)package\.json$/.test(lower)) score += 2;
  return score;
}

function scoreContent(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 10;
  }
  return score;
}

export async function fetchRepositoryCodeEvidence(
  owner: string,
  repo: string,
  criteria: string[],
  limit = 8,
  accessToken?: string,
): Promise<GhCodeEvidence[]> {
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(accessToken),
    cache: "no-store",
  });
  if (!metaRes.ok) return [];
  const meta = (await metaRes.json()) as GhRepoMeta;
  const branch = meta.default_branch ?? "main";

  const treeUrl = new URL(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}`,
  );
  treeUrl.searchParams.set("recursive", "1");
  const treeRes = await fetch(treeUrl, {
    headers: githubHeaders(accessToken),
    cache: "no-store",
  });
  if (!treeRes.ok) return [];

  const terms = queryTermsFrom(criteria);
  const tree = (await treeRes.json()) as GhTree;
  const rankedPaths = (tree.tree ?? [])
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => ({
      path: item.path!,
      size: item.size ?? 0,
      pathScore: scorePath(item.path!, terms),
    }))
    .filter((item) => isUsefulCodePath(item.path, item.size))
    .filter((item) => item.pathScore > 0)
    .sort((a, b) => b.pathScore - a.pathScore)
    .slice(0, 24);

  const evidence: (GhCodeEvidence & { score: number })[] = [];
  for (const item of rankedPaths) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${item.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const res = await fetch(rawUrl, {
      headers: githubRawHeaders(accessToken),
      cache: "no-store",
    });
    if (!res.ok) continue;
    const content = (await res.text()).slice(0, 12_000);
    evidence.push({
      repo: `${owner}/${repo}`,
      path: item.path,
      url: `https://github.com/${owner}/${repo}/blob/${branch}/${item.path}`,
      content,
      score: item.pathScore + scoreContent(content, terms),
    });
  }

  return evidence
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      repo: item.repo,
      path: item.path,
      url: item.url,
      content: item.content,
    }));
}
