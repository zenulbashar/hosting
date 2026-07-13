import { createSession, findUserByEmail, setSessionCookie, verifyPassword } from "@/lib/auth";
import { badRequest, json } from "@/lib/api";

export async function POST(req: Request) {
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
