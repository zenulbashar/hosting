import { createSession, createUser, findUserByEmail, setSessionCookie } from "@/lib/auth";
import { badRequest, json } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Limit account-creation abuse and blunt email enumeration: 5 per IP per hour.
  const rl = checkRateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address");
  if (name.length < 1) return badRequest("Enter your name");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");
  if (findUserByEmail(email)) return badRequest("An account with this email already exists");

  const user = createUser(email, name, password);
  await setSessionCookie(createSession(user.id));
  return json({ user: { id: user.id, email: user.email, name: user.name } }, 201);
}
