import { clearSession, getCurrentUser } from "@/lib/auth";
import { json } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  await clearSession();
  if (user) await recordAudit({ actorId: user.id, actor: user.email, action: "auth.logout" });
  return json({ ok: true });
}
