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

const HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "GPR/1.0",
};

export async function fetchCommits(
  owner: string,
  repo: string,
  since?: Date,
): Promise<GhCommit[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("per_page", "100");
  if (since) url.searchParams.set("since", since.toISOString());

  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
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
): Promise<GhPullRequest[]> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "all");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "50");

  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GitHub PRs ${owner}/${repo}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as GhPullRequest[];
}
