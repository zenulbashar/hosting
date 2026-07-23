import { createSession, findUserByEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { badRequest, json } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

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

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return badRequest("Invalid email or password");
  }

  await setSessionCookie(createSession(user.id));
  return json({ user: { id: user.id, email: user.email, name: user.name } });
}
