// Per-project Ask GPR chat persistence in localStorage. Keyed
// `gpr-ask-session-<projectId>` so each project has its own thread.
// Sessions self-expire after 7 days from first message.

const STORAGE_PREFIX = "gpr-ask-session-";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type StoredSession = {
  projectId: string;
  messages: StoredMessage[];
  createdAt: string;
  expiresAt: string;
};

const storageKey = (projectId: string) => `${STORAGE_PREFIX}${projectId}`;

export function loadAskSession(projectId: string): StoredSession | null {
  if (typeof window === "undefined") return null;
  const key = storageKey(projectId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (
      !parsed ||
      parsed.projectId !== projectId ||
      !Array.isArray(parsed.messages) ||
      typeof parsed.expiresAt !== "string"
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function saveAskSession(
  projectId: string,
  messages: StoredMessage[],
  existing: StoredSession | null,
): StoredSession {
  if (typeof window === "undefined") {
    return {
      projectId,
      messages,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    };
  }
  // Pin createdAt/expiresAt on first save so the 7-day window is
  // anchored to when the conversation began, not to the most recent
  // turn — that way a long, active chat doesn't extend its own life
  // indefinitely.
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const expiresAt =
    existing?.expiresAt ??
    new Date(Date.parse(createdAt) + TTL_MS).toISOString();
  const session: StoredSession = {
    projectId,
    messages,
    createdAt,
    expiresAt,
  };
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(session));
  return session;
}

export function clearAskSession(projectId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(projectId));
}
