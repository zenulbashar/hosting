import { deleteApiToken, getCurrentUser } from "@/lib/auth";
import { json, notFound, unauthorized } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ tokenId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { tokenId } = await params;
  if (!await deleteApiToken(user.id, tokenId)) return notFound("Token");
  await recordAudit({ actorId: user.id, actor: user.email, action: "token.revoked", target: tokenId });
  return json({ ok: true });
}
