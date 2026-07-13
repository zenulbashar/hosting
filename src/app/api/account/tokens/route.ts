import { createApiToken, getCurrentUser, listApiTokens } from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ tokens: listApiTokens(user.id) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) return badRequest("Token name is required");

  const { token, record } = createApiToken(user.id, name);
  // The plaintext token is returned exactly once; only its hash is stored.
  return json({ token, record }, 201);
}
