import { findDeployHookByToken } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { recordActivity } from "@/lib/activity";
import { json, notFound } from "@/lib/api";

type Params = { params: Promise<{ token: string }> };

/**
 * Public deploy-hook endpoint: POST (or GET, for services that only ping)
 * triggers a production deployment of the hook's branch. The unguessable
 * token in the URL is the credential, like Vercel's deploy hooks.
 */
async function trigger({ params }: Params) {
  const { token } = await params;
  const hook = findDeployHookByToken(token);
  if (!hook) return notFound("Deploy hook");

  const deployment = createDeployment(hook.project, {
    environment: "production",
    branch: hook.branch,
    commitMsg: `Triggered by deploy hook “${hook.name}”`,
  });
  recordActivity(
    hook.project_id,
    `deploy hook: ${hook.name}`,
    "deployment.created",
    `Deployment ${deployment.url_slug} triggered via deploy hook`
  );
  return json({
    deployment: {
      id: deployment.id,
      url_slug: deployment.url_slug,
      status: deployment.status,
      environment: deployment.environment,
      branch: deployment.branch,
      created_at: deployment.created_at,
    },
  }, 201);
}

export async function POST(_req: Request, ctx: Params) {
  return trigger(ctx);
}

export async function GET(_req: Request, ctx: Params) {
  return trigger(ctx);
}
