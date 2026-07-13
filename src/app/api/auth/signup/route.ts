import { createSession, createUser, findUserByEmail, setSessionCookie } from "@/lib/auth";
import { badRequest, json } from "@/lib/api";

export async function POST(req: Request) {
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
