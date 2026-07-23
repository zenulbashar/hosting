import { getCurrentUser } from "@/lib/auth";
import { listPendingInvitesForEmail } from "@/lib/teams";
import { json, unauthorized } from "@/lib/api";

/** Pending team invitations addressed to the current user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ invites: listPendingInvitesForEmail(user.email) });
}
