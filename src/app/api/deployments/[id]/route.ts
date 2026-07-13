import { getCurrentUser } from "@/lib/auth";
import { getDeploymentForUser, getLogs } from "@/lib/data";
import { cancelDeployment } from "@/lib/deploy-engine";
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

/** Cancel a running deployment. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const deployment = getDeploymentForUser(user.id, id);
  if (!deployment) return notFound("Deployment");

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "cancel") return badRequest("Unsupported action");
  const canceled = cancelDeployment(id);
  return json({ canceled });
}
