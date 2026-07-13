import { getCurrentUser, updateUserName } from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 100) return badRequest("Enter a valid name");

  updateUserName(user.id, name);
  return json({ user: { ...user, name } });
}
