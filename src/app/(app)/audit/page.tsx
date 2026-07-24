import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAudit, verifyAuditChain } from "@/lib/audit";
import { timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Security & Audit Log" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.signup": "Account created",
  "auth.logout": "Signed out",
  "token.created": "API token created",
  "token.revoked": "API token revoked",
  "plan.changed": "Plan changed",
  "project.deleted": "Project deleted",
  "database.deleted": "Database deleted",
};

function summarize(metadata: string | null): string {
  if (!metadata) return "";
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    return Object.entries(m)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  } catch {
    return "";
  }
}

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [entries, verification] = await Promise.all([listAudit(user.id), verifyAuditChain()]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Security & Audit Log"
        description="A tamper-evident record of security-sensitive actions on your account. Each entry is hash-chained to the one before it, so any change to the history is detectable."
      />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm font-medium">Integrity</div>
          <div className="mt-0.5 text-[13px] text-fg-muted">
            {verification.ok
              ? "The audit chain is intact — no tampering detected."
              : "The audit chain shows signs of tampering. Contact your platform operator."}
          </div>
        </div>
        <Badge tone={verification.ok ? "success" : "danger"}>
          {verification.ok ? "Chain verified" : "Tampering detected"}
        </Badge>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Security-sensitive actions — sign-ins, token changes, plan changes, deletions — will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-edge">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {ACTION_LABEL[e.action] ?? e.action}
                    {e.target && <span className="ml-2 font-mono text-xs text-fg-faint">{e.target}</span>}
                  </div>
                  {summarize(e.metadata) && (
                    <div className="mt-0.5 truncate text-xs text-fg-faint">{summarize(e.metadata)}</div>
                  )}
                </div>
                {e.trace_id && (
                  <code
                    className="hidden font-mono text-[11px] text-fg-faint sm:block"
                    title="Trace ID — quote this to correlate logs for the request"
                  >
                    {e.trace_id.slice(0, 12)}…
                  </code>
                )}
                <time className="text-xs text-fg-muted" title={new Date(e.ts).toISOString()}>
                  {timeAgo(e.ts)}
                </time>
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
