/**
 * Deterministic synthetic traffic metrics, seeded by project id so numbers are
 * stable across reloads. Replace with real edge/analytics ingestion later.
 */

export type DayMetric = {
  /** ms timestamp at local midnight */
  ts: number;
  requests: number;
  /** bytes */
  bandwidth: number;
  errors: number;
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate `days` of daily metrics ending today (oldest first). */
export function generateMetrics(projectId: string, days: number): DayMetric[] {
  const rand = mulberry32(hashSeed(projectId));
  const base = 800 + Math.floor(rand() * 40000); // project's typical daily requests
  const growth = 0.7 + rand() * 0.9; // overall trend across the window
  const bytesPerReq = 45_000 + rand() * 400_000;

  const out: DayMetric[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const ts = today.getTime() - i * 86_400_000;
    const dow = new Date(ts).getDay();
    const weekend = dow === 0 || dow === 6 ? 0.62 : 1;
    const progress = (days - 1 - i) / Math.max(days - 1, 1);
    const trend = 1 + (growth - 1) * progress;
    const noise = 0.75 + rand() * 0.5;
    const requests = Math.max(0, Math.round(base * weekend * trend * noise));
    const errors = Math.round(requests * (0.001 + rand() * 0.012));
    const bandwidth = Math.round(requests * bytesPerReq * (0.85 + rand() * 0.3));
    out.push({ ts, requests, bandwidth, errors });
  }
  return out;
}
