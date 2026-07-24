/**
 * Multi-region control plane.
 *
 * Region health lives in `region_health`; placement and failover are pure
 * functions over it. A deployment rolls out to every operational region (the
 * global edge); regions that are `down` at rollout time are skipped and logged.
 * At serve time, the edge picks the healthiest region that actually holds the
 * deployment, preferring the project's home region and failing over when it's
 * unavailable.
 *
 * The health table is the seam to real infrastructure: replace `setRegionHealth`
 * (currently driven by the status page / an operator) with a feed from real
 * health checks, and everything above — rollout, failover, serving — is unchanged.
 */
import { db } from "./db";
import { REGIONS, getRegion, type Region } from "./regions";

export type RegionStatus = "operational" | "degraded" | "down";

export type RegionHealth = {
  region: string;
  status: RegionStatus;
  latency_ms: number;
  updated_at: number;
};

export type RegionHealthView = RegionHealth & { meta: Region };

const AVAILABLE = REGIONS.filter((r) => r.available);

// Deterministic base latency per region so seeded values are stable (no RNG at
// seed time, which would also break workflow determinism).
function baseLatency(region: string): number {
  let h = 0;
  for (let i = 0; i < region.length; i++) h = (h * 31 + region.charCodeAt(i)) >>> 0;
  return 12 + (h % 40); // 12–51 ms
}

/** Idempotently register every available region as operational. Runs at boot. */
export async function seedRegionHealth(): Promise<void> {
  const now = Date.now();
  for (const r of AVAILABLE) {
    await db
      .prepare(
        `INSERT INTO region_health (region, status, latency_ms, updated_at)
         VALUES (?, 'operational', ?, ?)
         ON CONFLICT (region) DO NOTHING`
      )
      .run(r.id, baseLatency(r.id), now);
  }
}

export async function listRegionHealth(): Promise<RegionHealthView[]> {
  await seedRegionHealth();
  const rows = await db.prepare("SELECT * FROM region_health").all<RegionHealth>();
  const byId = new Map(rows.map((r) => [r.region, r]));
  // Preserve the canonical REGIONS order (Sydney first).
  return AVAILABLE.map((meta) => {
    const row = byId.get(meta.id) ?? { region: meta.id, status: "operational" as const, latency_ms: baseLatency(meta.id), updated_at: 0 };
    return { ...row, meta };
  });
}

export async function getRegionStatus(region: string): Promise<RegionStatus> {
  const row = await db.prepare("SELECT status FROM region_health WHERE region = ?").get<{ status: RegionStatus }>(region);
  return row?.status ?? "operational";
}

export async function setRegionHealth(region: string, status: RegionStatus): Promise<boolean> {
  if (!AVAILABLE.some((r) => r.id === region)) return false;
  await seedRegionHealth();
  // A degraded region carries extra latency; down is unreachable.
  const extra = status === "degraded" ? 180 : 0;
  await db
    .prepare("UPDATE region_health SET status = ?, latency_ms = ?, updated_at = ? WHERE region = ?")
    .run(status, baseLatency(region) + extra, Date.now(), region);
  return true;
}

/** The regions a deployment is rolled out to: its home region first, then the
 *  rest of the global edge. */
export function targetRegions(home: string): { region: string; role: "primary" | "edge" }[] {
  const primary = getRegion(home).id;
  const edges = AVAILABLE.map((r) => r.id).filter((id) => id !== primary);
  return [{ region: primary, role: "primary" }, ...edges.map((region) => ({ region, role: "edge" as const }))];
}

/**
 * Choose which region serves a request, given the regions that actually hold
 * the deployment. Prefers the home region, then lowest-latency healthy region;
 * skips `down` regions entirely. Returns null only if every holder is down.
 */
export function pickServingRegion(
  home: string,
  holders: { region: string; status: RegionStatus; latency_ms: number }[]
): { region: string; failedOver: boolean } | null {
  const usable = holders.filter((h) => h.status !== "down");
  if (usable.length === 0) return null;
  const homeUsable = usable.find((h) => h.region === home);
  if (homeUsable && homeUsable.status === "operational") {
    return { region: home, failedOver: false };
  }
  // Home is degraded or missing — pick the healthiest alternative by
  // (operational first, then latency).
  const ranked = [...usable].sort((a, b) => {
    const ao = a.status === "operational" ? 0 : 1;
    const bo = b.status === "operational" ? 0 : 1;
    return ao - bo || a.latency_ms - b.latency_ms;
  });
  const best = ranked[0];
  return { region: best.region, failedOver: best.region !== home };
}

// ---------- per-deployment regional rollout ----------

/** Roll a deployment out, skipping regions that are down. Sites spread across
 *  the whole edge; always-on agents run only in their home region. */
export async function rolloutDeployment(
  deploymentId: string,
  home: string,
  opts?: { spread?: boolean }
): Promise<{ ready: string[]; skipped: string[] }> {
  const ready: string[] = [];
  const skipped: string[] = [];
  const targets = opts?.spread === false ? targetRegions(home).slice(0, 1) : targetRegions(home);
  for (const t of targets) {
    const status = await getRegionStatus(t.region);
    const rolloutStatus = status === "down" ? "skipped" : "ready";
    (rolloutStatus === "ready" ? ready : skipped).push(t.region);
    await db
      .prepare(
        `INSERT INTO deployment_regions (deployment_id, region, role, status)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (deployment_id, region) DO UPDATE SET status = excluded.status, role = excluded.role`
      )
      .run(deploymentId, t.region, t.role, rolloutStatus);
  }
  return { ready, skipped };
}

export type DeploymentRegionView = {
  region: string;
  role: string;
  status: string;
  health: RegionStatus;
  latency_ms: number;
  meta: Region;
};

export async function listDeploymentRegions(deploymentId: string): Promise<DeploymentRegionView[]> {
  const rows = await db
    .prepare(
      `SELECT dr.region, dr.role, dr.status,
              COALESCE(rh.status, 'operational') AS health,
              COALESCE(rh.latency_ms, 20) AS latency_ms
       FROM deployment_regions dr
       LEFT JOIN region_health rh ON rh.region = dr.region
       WHERE dr.deployment_id = ?`
    )
    .all<{ region: string; role: string; status: string; health: RegionStatus; latency_ms: number }>(deploymentId);
  return rows
    .map((r) => ({ ...r, meta: getRegion(r.region) }))
    .sort((a, b) => (a.role === "primary" ? -1 : b.role === "primary" ? 1 : a.latency_ms - b.latency_ms));
}

/** Which region should serve this deployment right now (with failover). */
export async function servingRegionFor(
  deploymentId: string,
  home: string
): Promise<{ region: string; failedOver: boolean } | null> {
  const rows = await db
    .prepare(
      `SELECT dr.region, COALESCE(rh.status, 'operational') AS status, COALESCE(rh.latency_ms, 20) AS latency_ms
       FROM deployment_regions dr
       LEFT JOIN region_health rh ON rh.region = dr.region
       WHERE dr.deployment_id = ? AND dr.status = 'ready'`
    )
    .all<{ region: string; status: RegionStatus; latency_ms: number }>(deploymentId);
  // Backward compatibility: deployments created before rollout tracking are
  // treated as held only in their home region.
  if (rows.length === 0) {
    const status = await getRegionStatus(home);
    return pickServingRegion(home, [{ region: home, status, latency_ms: 20 }]);
  }
  return pickServingRegion(home, rows);
}
