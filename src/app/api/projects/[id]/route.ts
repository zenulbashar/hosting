import { getCurrentUser } from "@/lib/auth";
import { deleteProject, getProject, updateProject } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { recordAudit } from "@/lib/audit";
import { REGIONS } from "@/lib/regions";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ project });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  if (!await getProject(user.id, id)) return notFound("Project");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid body");

  const patch: Record<string, unknown> = {};
  for (const key of ["name", "framework", "root_dir", "build_command", "output_dir", "install_command", "node_version", "region"]) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  if ("region" in patch && !REGIONS.some((r) => r.id === patch.region && r.available)) {
    delete patch.region;
  }
  if (typeof patch.name === "string" && patch.name.trim().length === 0) {
    return badRequest("Project name cannot be empty");
  }
  if (patch.name === null) delete patch.name;

  const project = await updateProject(user.id, id, patch);
  await recordActivity(id, user.name, "project.updated", "Project settings updated");
  return json({ project });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!await deleteProject(user.id, id)) return notFound("Project");
  await recordAudit({ actorId: user.id, actor: user.name, action: "project.deleted", target: id, metadata: { name: project?.name } });
  return json({ ok: true });
}
