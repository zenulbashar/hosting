import { getCurrentUser } from "@/lib/auth";
import { setRegionHealth, listRegionHealth, type RegionStatus } from "@/lib/region-health";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const VALID: RegionStatus[] = ["operational", "degraded", "down"];

/**
 * Set a region's health. Drives rollout skips and serve-time failover — the
 * status page uses it to simulate an outage. In production this endpoint is
 * replaced by a feed from real health checks.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const status = body?.status as RegionStatus;
  if (!VALID.includes(status)) return badRequest("status must be operational, degraded or down");

  if (!(await setRegionHealth(id, status))) return notFound("Region");
  await recordAudit({
    actorId: user.id,
    actor: user.email,
    action: "region.status_changed",
    target: id,
    metadata: { status },
  });
  return json({ regions: await listRegionHealth() });
}
