import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { branchConnection, getDatabase, listBranches, zaleDb } from "@/lib/zale-db";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string; dbId: string }> };

/**
 * Reveal the full connection string (with password) for one branch. Rate-limited
 * and owner-authenticated; the password is only ever returned here, never in the
 * list endpoint.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, dbId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "reveal") return badRequest("Unsupported action");

  const rl = checkRateLimit(`dbreveal:${clientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many reveal requests. Try again shortly." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  const database = await getDatabase(project.id, dbId);
  if (!database) return notFound("Database");
  const branchId = typeof body?.branchId === "string" ? body.branchId : "";
  const branch = (await listBranches(database.id)).find((b) => b.id === branchId);
  if (!branch) return notFound("Branch");

  const conn = await branchConnection(database, branch, { reveal: true });
  if (!conn) return notFound("Credentials");
  return json({ connectionString: conn.connectionString });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id, dbId } = await params;
  const project = await getProject(user.id, id);
  if (!project) return notFound("Project");
  if (!(await zaleDb.deleteDatabase(project.id, dbId, user.name))) return notFound("Database");
  return json({ ok: true });
}
