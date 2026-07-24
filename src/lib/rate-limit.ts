/**
 * In-process sliding-window rate limiter.
 *
 * Adequate while the platform is single-instance. When the web tier scales to
 * multiple replicas (roadmap M2+), swap the Map for a shared store (Redis
 * INCR + EXPIRE, or Upstash) behind this same `check()` signature — call sites
 * don't change.
 */
type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as { __zaleRl?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForRl.__zaleRl ?? new Map();
globalForRl.__zaleRl = buckets;

export type RateLimitResult = { ok: boolean; retryAfter: number };

/**
 * Returns `{ ok: false, retryAfter }` when `key` has exceeded `limit` requests
 * within `windowMs`. Windows are fixed and per-key (e.g. per IP + route).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client IP for rate-limit bucketing, resistant to header spoofing.
 *
 * `x-real-ip` (set by the trusted proxy) is preferred. For `x-forwarded-for` we
 * take the RIGHTMOST entry — the hop appended by our own proxy — not the
 * leftmost, which is fully client-controlled: an attacker could rotate a fake
 * leftmost value to get a fresh bucket per request and defeat the limiter.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

/** Opportunistic eviction so the Map can't grow unbounded under attack. */
function sweep() {
  const now = Date.now();
  if (buckets.size < 10_000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}
setInterval(sweep, 60_000).unref?.();
