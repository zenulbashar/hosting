import {
  currentSessionToken,
  getCurrentUser,
  revokeUserSessions,
  updateUserPassword,
} from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";
  if (next.length < 8) return badRequest("New password must be at least 8 characters");

  if (!await updateUserPassword(user.id, current, next)) {
    return badRequest("Current password is incorrect");
  }

  // Evict every other session so a stolen/compromised session can't ride along
  // after the owner rotates their password. The caller's own session survives.
  await revokeUserSessions(user.id, await currentSessionToken());
  return json({ ok: true });
}
