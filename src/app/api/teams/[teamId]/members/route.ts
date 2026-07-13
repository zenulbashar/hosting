import { getCurrentUser } from "@/lib/auth";
import { getTeamForUser, inviteToTeam } from "@/lib/teams";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ teamId: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { teamId } = await params;
  const team = getTeamForUser(user.id, teamId);
  if (!team) return notFound("Team");
  if (team.role !== "owner") return badRequest("Only owners can invite members");

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = body?.role === "owner" ? "owner" : "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address");

  const result = inviteToTeam(teamId, email, role);
  return json(result, 201);
}
