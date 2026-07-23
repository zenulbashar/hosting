import { getCurrentUser } from "@/lib/auth";
import { computeUsage, getPlan, PLANS, setPlan, type PlanId } from "@/lib/billing";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ plan: await getPlan(user.id), usage: await computeUsage(user.id) });
}

/** Switch plan. A real billing provider (Stripe etc.) slots in here later. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const plan = body?.plan as PlanId;
  if (!PLANS[plan]) return badRequest("Unknown plan");

  await setPlan(user.id, plan);
  return json({ plan: PLANS[plan] });
}
