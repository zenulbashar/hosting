import { getCurrentUser } from "@/lib/auth";
import { deleteDomain, getProject, verifyDomain } from "@/lib/data";
import { recordActivity } from "@/lib/activity";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string; domainId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, domainId } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "verify") return badRequest("Unsupported action");
  if (!verifyDomain(project.id, domainId)) return notFound("Domain");
  recordActivity(project.id, user.name, "domain.verified", "Domain verified");
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, domainId } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");
  if (!deleteDomain(project.id, domainId)) return notFound("Domain");
  return json({ ok: true });
}
