import { getCurrentUser } from "@/lib/auth";
import { addDomain, getProject, listDomains } from "@/lib/data";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ domains: listDomains(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.toLowerCase().trim() : "";
  if (!DOMAIN_RE.test(name)) return badRequest("Enter a valid domain, e.g. app.example.com");
  const exists = db.prepare("SELECT 1 FROM domains WHERE name = ?").get(name);
  if (exists) return badRequest("This domain is already in use");

  // Custom domains start unverified; the owner confirms DNS then clicks Verify.
  return json({ domain: addDomain(project.id, name) }, 201);
}
