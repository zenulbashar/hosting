import { getCurrentUser } from "@/lib/auth";
import { listAudit, verifyAuditChain } from "@/lib/audit";
import { json, unauthorized } from "@/lib/api";

/** The caller's own audit trail plus the tamper-evidence verdict. Only the
 *  boolean verdict is exposed — the chain is global, so its row count and any
 *  break position are not disclosed to individual tenants. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const [entries, verification] = await Promise.all([listAudit(user.id), verifyAuditChain()]);
  return json({ entries, verified: verification.ok });
}
