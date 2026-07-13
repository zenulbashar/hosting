import { getCurrentUser } from "@/lib/auth";
import { deleteInvite, getTeamForUser, removeMember } from "@/lib/teams";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ teamId: string; memberId: string }> };

/** memberId is a user id (membership) or an invite id (pending invite). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { teamId, memberId } = await params;
  const team = getTeamForUser(user.id, teamId);
  if (!team) return notFound("Team");

  // Members may remove themselves (leave); otherwise owner-only.
  if (team.role !== "owner" && memberId !== user.id) {
    return badRequest("Only owners can remove other members");
  }

  if (memberId.startsWith("inv_")) {
    if (team.role !== "owner") return badRequest("Only owners can revoke invites");
    if (!deleteInvite(teamId, memberId)) return notFound("Invite");
    return json({ ok: true });
  }

  if (!removeMember(teamId, memberId)) {
    return badRequest("Cannot remove the last owner of a team");
  }
  return json({ ok: true });
}
