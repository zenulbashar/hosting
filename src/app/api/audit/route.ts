import { getCurrentUser } from "@/lib/auth";
import { listAudit, verifyAuditChain } from "@/lib/audit";
import { json, unauthorized } from "@/lib/api";

/** The caller's own audit trail plus the global tamper-evidence verdict. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const [entries, verification] = await Promise.all([listAudit(user.id), verifyAuditChain()]);
  return json({ entries, verification });
}
