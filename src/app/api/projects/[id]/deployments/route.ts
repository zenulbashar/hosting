import { getCurrentUser } from "@/lib/auth";
import { getProject, listDeployments } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ deployments: listDeployments(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => ({}));
  const environment = body?.environment === "preview" ? "preview" : "production";
  const deployment = createDeployment(project, {
    environment,
    commitMsg: typeof body?.commit_msg === "string" ? body.commit_msg : undefined,
  });
  return json({ deployment }, 201);
}
