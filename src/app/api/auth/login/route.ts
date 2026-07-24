import { createSession, findUserByEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { badRequest, json } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export async function POST(req: Request) {
  // Throttle credential-stuffing / brute force: 10 attempts per IP per 15 min.
  const rl = checkRateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    await recordAudit({ actor: email || "unknown", action: "auth.login_failed", metadata: { ip: clientIp(req) } });
    return badRequest("Invalid email or password");
  }

  await setSessionCookie(await createSession(user.id));
  await recordAudit({ actorId: user.id, actor: user.email, action: "auth.login", metadata: { ip: clientIp(req) } });
  return json({ user: { id: user.id, email: user.email, name: user.name } });
}
