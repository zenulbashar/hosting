import { getCurrentUser } from "@/lib/auth";
import { deleteEnvVar, getProject } from "@/lib/data";
import { json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; envId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, envId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  if (!await deleteEnvVar(project.id, envId)) return notFound("Environment variable");
  return json({ ok: true });
}
