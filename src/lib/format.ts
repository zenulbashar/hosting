/** Isomorphic helpers — safe to import from both server and client components. */

/** Deployment statuses that are still progressing. */
export const IN_FLIGHT: ReadonlySet<string> = new Set(["QUEUED", "BUILDING", "DEPLOYING"]);

export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Derive a plausible repo name from a git URL, e.g. github.com/acme/shop -> acme/shop */
export function repoLabel(repoUrl: string): string {
  try {
    const cleaned = repoUrl.replace(/\.git$/, "");
    const u = new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    return u.hostname + u.pathname;
  } catch {
    return repoUrl;
  }
}

/** Public URL for a deployment slug on the platform's shared domain. */
export function deploymentUrl(urlSlug: string): string {
  return `${urlSlug}.nimbus.app`;
}
