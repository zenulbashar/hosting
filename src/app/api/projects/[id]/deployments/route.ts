import { getCurrentUser } from "@/lib/auth";
import { getProject, listDeployments } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { recordActivity } from "@/lib/activity";
import { checkBuildMinutesQuota } from "@/lib/quota";
import { json, notFound, paymentRequired, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ deployments: await listDeployments(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");

  // Enforce the trailing-30-day build-minute budget (personal projects only).
  if (!project.team_id) {
    const quota = await checkBuildMinutesQuota(user.id);
    if (!quota.ok) return paymentRequired(quota.message!, { quota });
  }

  const body = await req.json().catch(() => ({}));
  const environment = body?.environment === "preview" ? "preview" : "production";
  const deployment = await createDeployment(project, {
    environment,
    commitMsg: typeof body?.commit_msg === "string" ? body.commit_msg : undefined,
  });
  await recordActivity(project.id, user.name, "deployment.created",
    `Deployment ${deployment.url_slug} created (${environment})`);
  return json({ deployment }, 201);
}
