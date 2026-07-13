import { getCurrentUser } from "@/lib/auth";
import { createTeam, listTeamsForUser } from "@/lib/teams";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ teams: listTeamsForUser(user.id) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) return badRequest("Team name is required");

  return json({ team: createTeam(user.id, name) }, 201);
}
