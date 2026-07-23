import { getCurrentUser } from "@/lib/auth";
import { deleteDomain, getDomain, getProject, verifyDomain } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { verifyDomainDns } from "@/lib/dns";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string; domainId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, domainId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "verify") return badRequest("Unsupported action");

  // DNS lookups are comparatively expensive; cap per-IP to prevent abuse.
  const rl = checkRateLimit(`domverify:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many verification attempts. Try again shortly." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  const domain = await getDomain(project.id, domainId);
  if (!domain) return notFound("Domain");
  if (domain.verified === 1) return json({ ok: true, verified: true, method: "already" });

  // Real DNS check — verifies control (TXT challenge) or routing (A/CNAME).
  const result = await verifyDomainDns(domain.name, domain.verification_token);
  if (!result.verified) {
    return json({
      ok: true,
      verified: false,
      message:
        "No matching DNS record found yet. Add the TXT record below (or point your A/CNAME at us), then verify again — DNS changes can take a few minutes to propagate.",
      checks: result.checks,
    });
  }

  await verifyDomain(project.id, domainId);
  await recordActivity(project.id, user.name, "domain.verified", `Domain ${domain.name} verified (${result.method})`);
  return json({ ok: true, verified: true, method: result.method });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, domainId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  if (!await deleteDomain(project.id, domainId)) return notFound("Domain");
  return json({ ok: true });
}
