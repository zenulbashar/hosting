import { getCurrentUser } from "@/lib/auth";
import { deleteProject, getProject, updateProject } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { recordAudit } from "@/lib/audit";
import { getFramework, isKnownFramework } from "@/lib/frameworks";
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

  // Only these three columns are nullable; blanking one clears it. The rest are
  // NOT NULL, so an empty value must be rejected or fall back to a default —
  // never written as NULL (which would 500 the whole save and lose all fields).
  const NULLABLE = new Set(["build_command", "output_dir", "install_command"]);
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "framework", "root_dir", "build_command", "output_dir", "install_command", "node_version", "region"]) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (NULLABLE.has(key)) {
      patch[key] = raw === "" || raw == null ? null : String(raw);
    } else if (typeof raw === "string") {
      patch[key] = raw;
    }
  }
  if ("name" in patch && (typeof patch.name !== "string" || patch.name.trim().length === 0)) {
    return badRequest("Project name cannot be empty");
  }
  // Reject unknown frameworks rather than silently coercing them.
  if ("framework" in patch) {
    if (!isKnownFramework(String(patch.framework))) return badRequest("Unknown framework");
    patch.framework = getFramework(String(patch.framework)).id;
  }
  // A blank root directory falls back to the repository root.
  if ("root_dir" in patch && String(patch.root_dir).trim() === "") patch.root_dir = "./";
  // A blank Node version leaves the existing one untouched.
  if ("node_version" in patch && String(patch.node_version).trim() === "") delete patch.node_version;
  // Only accept an available region.
  if ("region" in patch && !REGIONS.some((r) => r.id === patch.region && r.available)) delete patch.region;

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
