import { getCurrentUser } from "@/lib/auth";
import { computeUsage, getPlan, PLANS, setPlan, type PlanId } from "@/lib/billing";
import { badRequest, json, unauthorized } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

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
  const plan = body?.plan;
  // Object.hasOwn rejects inherited keys ("__proto__", "constructor", …) that
  // bracket-truthiness would accept and then persist, wedging the account.
  if (typeof plan !== "string" || !Object.hasOwn(PLANS, plan)) return badRequest("Unknown plan");

  const planId = plan as PlanId;
  const previous = await getPlan(user.id);
  await setPlan(user.id, planId);
  await recordAudit({
    actorId: user.id,
    actor: user.email,
    action: "plan.changed",
    metadata: { from: previous.id, to: planId },
  });
  return json({ plan: PLANS[planId] });
}
