import { getCurrentUser } from "@/lib/auth";
import { getDeploymentForUser, getLogs, promoteDeployment } from "@/lib/data";
import { cancelDeployment } from "@/lib/deploy-engine";
import { recordActivity } from "@/lib/activity";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** Poll endpoint: returns deployment state plus log lines after ?after=<logId>. */
export async function GET(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const deployment = getDeploymentForUser(user.id, id);
  if (!deployment) return notFound("Deployment");

  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  return json({ deployment, logs: getLogs(id, after) });
}

/** Deployment actions: cancel a running build, or promote/rollback a READY one. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const deployment = getDeploymentForUser(user.id, id);
  if (!deployment) return notFound("Deployment");

  const body = await req.json().catch(() => ({}));

  if (body?.action === "cancel") {
    const canceled = cancelDeployment(id);
    if (canceled) {
      recordActivity(deployment.project_id, user.name, "deployment.canceled",
        `Deployment ${deployment.url_slug} canceled`);
    }
    return json({ canceled });
  }

  if (body?.action === "promote") {
    if (deployment.is_current === 1) return badRequest("Deployment is already live");
    const promoted = promoteDeployment(user.id, id);
    if (!promoted) return badRequest("Only READY deployments can be promoted");
    recordActivity(deployment.project_id, user.name, "deployment.promoted",
      `Deployment ${deployment.url_slug} promoted to production (rollback)`);
    return json({ deployment: promoted });
  }

  return badRequest("Unsupported action");
}
