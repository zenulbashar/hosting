import { getCurrentUser, updateUserPassword } from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  if (next.length < 8) return badRequest("New password must be at least 8 characters");

  if (!updateUserPassword(user.id, current, next)) {
    return badRequest("Current password is incorrect");
  }
  return json({ ok: true });
}
