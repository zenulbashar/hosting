import { getCurrentUser } from "@/lib/auth";
import { createEnvVar, getProject, listEnvVars } from "@/lib/data";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const VALID_TARGETS = ["production", "preview", "development"];
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ env: listEnvVars(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const value = typeof body?.value === "string" ? body.value : "";
  const targets = Array.isArray(body?.targets)
    ? body.targets.filter((t: unknown) => typeof t === "string" && VALID_TARGETS.includes(t))
    : VALID_TARGETS;

  if (!KEY_RE.test(key)) return badRequest("Key must match [A-Za-z_][A-Za-z0-9_]*");
  if (targets.length === 0) return badRequest("Select at least one environment");
  if (listEnvVars(project.id).some((e) => e.key === key && e.targets.split(",").some((t) => targets.includes(t)))) {
    return badRequest(`${key} already exists for one of the selected environments`);
  }

  return json({ env: createEnvVar(project.id, key, value, targets) }, 201);
}
