/**
 * Resolve the public base URL for outbound links (email invites,
 * webhook callbacks, etc).
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL — explicit canonical URL (set this on Vercel).
 *   2. https://${VERCEL_URL} — auto-set by Vercel for every deployment.
 *      Useful as a fallback so preview deploys produce working links.
 *   3. http://localhost:3000 — local dev fallback.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
