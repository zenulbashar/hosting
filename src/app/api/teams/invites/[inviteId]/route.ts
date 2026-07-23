import { getCurrentUser } from "@/lib/auth";
import { acceptInvite, declineInvite } from "@/lib/teams";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ inviteId: string }> };

/** Accept or decline an invite addressed to the current user's email. */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { inviteId } = await params;

  const body = await req.json().catch(() => ({}));
  if (body?.action === "accept") {
    if (!acceptInvite(user.id, user.email, inviteId)) return notFound("Invitation");
    return json({ ok: true, accepted: true });
  }
  if (body?.action === "decline") {
    if (!declineInvite(user.email, inviteId)) return notFound("Invitation");
    return json({ ok: true, accepted: false });
  }
  return badRequest("action must be 'accept' or 'decline'");
}
