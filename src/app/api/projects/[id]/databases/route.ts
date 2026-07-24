import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { badRequest, json, notFound, paymentRequired, unauthorized } from "@/lib/api";
import { checkDatabaseQuota } from "@/lib/quota";
import { REGIONS } from "@/lib/regions";
import { branchConnection, listBranches, listDatabases, zaleDb } from "@/lib/zale-db";

type Params = { params: Promise<{ id: string }> };

const NAME_RE = /^[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Databases with their branches and masked (password-free) connection strings. */
async function serialize(projectId: string) {
  const databases = await listDatabases(projectId);
  return Promise.all(
    databases.map(async (database) => {
      const branches = await listBranches(database.id);
      const connections = await Promise.all(branches.map((b) => branchConnection(database, b)));
      return { ...database, branches: connections.filter(Boolean) };
    })
  );
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  return json({ databases: await serialize(project.id) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.toLowerCase().trim() : "";
  if (!NAME_RE.test(name)) {
    return badRequest("Database name must be 1–40 chars: lowercase letters, numbers and hyphens.");
  }
  const region = typeof body?.region === "string" && body.region ? body.region : project.region;
  if (!REGIONS.some((r) => r.id === region && r.available)) {
    return badRequest("Unknown or unavailable region.");
  }

  const existing = await listDatabases(project.id);
  if (existing.some((d) => d.name === name)) return badRequest("A database with that name already exists.");

  // Enforce the personal database quota (team projects are billed to the team).
  if (!project.team_id) {
    const quota = await checkDatabaseQuota(user.id);
    if (!quota.ok) return paymentRequired(quota.message!, { quota });
  }

  await zaleDb.provisionDatabase(project.id, name, region, user.name);
  return json({ databases: await serialize(project.id) }, 201);
}
