import { getCurrentUser } from "@/lib/auth";
import {
  deleteTeam,
  getTeamForUser,
  listInvites,
  listMembers,
  renameTeam,
} from "@/lib/teams";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ teamId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { teamId } = await params;
  const team = getTeamForUser(user.id, teamId);
  if (!team) return notFound("Team");
  return json({ team, members: listMembers(teamId), invites: listInvites(teamId) });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { teamId } = await params;
  const team = getTeamForUser(user.id, teamId);
  if (!team) return notFound("Team");
  if (team.role !== "owner") return badRequest("Only owners can rename a team");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) return badRequest("Team name is required");
  renameTeam(teamId, name);
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { teamId } = await params;
  const team = getTeamForUser(user.id, teamId);
  if (!team) return notFound("Team");
  if (team.role !== "owner") return badRequest("Only owners can delete a team");
  deleteTeam(teamId);
  return json({ ok: true });
}
