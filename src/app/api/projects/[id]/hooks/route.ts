import { getCurrentUser } from "@/lib/auth";
import { createDeployHook, getProject, listDeployHooks } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ hooks: await listDeployHooks(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const branch = typeof body?.branch === "string" ? body.branch.trim() : "main";
  if (name.length < 1 || name.length > 60) return badRequest("Hook name is required");

  const hook = await createDeployHook(project.id, name, branch);
  await recordActivity(project.id, user.name, "hook.created", `Deploy hook “${name}” created for ${hook.branch}`);
  return json({ hook }, 201);
}
