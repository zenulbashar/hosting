import { getCurrentUser } from "@/lib/auth";
import { deleteDeployHook, getProject } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; hookId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, hookId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  if (!await deleteDeployHook(project.id, hookId)) return notFound("Deploy hook");
  await recordActivity(project.id, user.name, "hook.deleted", "Deploy hook deleted");
  return json({ ok: true });
}
