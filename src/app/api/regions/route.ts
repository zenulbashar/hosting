import { getCurrentUser } from "@/lib/auth";
import { listRegionHealth } from "@/lib/region-health";
import { json, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ regions: await listRegionHealth() });
}
