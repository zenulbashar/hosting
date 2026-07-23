import { findDeployHookByToken } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { recordActivity } from "@/lib/activity";
import { verifyHmac } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { json, notFound } from "@/lib/api";

type Params = { params: Promise<{ token: string }> };

/**
 * Public deploy-hook endpoint. POST-only — a GET must never mutate, so crawlers,
 * link-preview bots and browser prefetch can no longer trigger a production
 * deploy. The unguessable token in the URL is the credential (like Vercel).
 *
 * Defense in depth: if the caller sends an `X-Zale-Signature: sha256=<hmac>`
 * header, it MUST be a valid HMAC-SHA256 of the raw body keyed by the hook
 * token — a bad signature fails closed. Senders that can't sign simply omit it.
 */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  const hook = findDeployHookByToken(token);
  if (!hook) return notFound("Deploy hook");

  // Cap trigger rate per hook to prevent a leaked token from being weaponized.
  const rl = checkRateLimit(`hook:${token}`, 20, 60 * 1000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  const signature = req.headers.get("x-zale-signature");
  if (signature) {
    const raw = await req.text();
    if (!verifyHmac(hook.token, raw, signature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const deployment = createDeployment(hook.project, {
    environment: "production",
    branch: hook.branch,
    commitMsg: `Triggered by deploy hook "${hook.name}"`,
  });
  recordActivity(
    hook.project_id,
    `deploy hook: ${hook.name}`,
    "deployment.created",
    `Deployment ${deployment.url_slug} triggered via deploy hook`
  );
  return json(
    {
      deployment: {
        id: deployment.id,
        url_slug: deployment.url_slug,
        status: deployment.status,
        environment: deployment.environment,
        branch: deployment.branch,
        created_at: deployment.created_at,
      },
    },
    201
  );
}
