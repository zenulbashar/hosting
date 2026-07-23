import { deleteApiToken, getCurrentUser } from "@/lib/auth";
import { json, notFound, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ tokenId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { tokenId } = await params;
  if (!await deleteApiToken(user.id, tokenId)) return notFound("Token");
  return json({ ok: true });
}
