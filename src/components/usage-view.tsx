"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice, Plan, Usage } from "@/lib/billing";
import { Button, Card, Spinner } from "@/components/ui";

function bytes(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Quota meter (dataviz spec): the fill carries severity — accent below 70%,
 * warning to 90%, danger beyond — and the unfilled track is a dim step of the
 * fill's own hue so state reads across the whole bar. Values stay in text ink.
 */
function Meter({
  label,
  used,
  quota,
  format,
}: {
  label: string;
  used: number;
  quota: number;
  format: (v: number) => string;
}) {
  const ratio = Math.min(1, quota > 0 ? used / quota : 0);
  const fill = ratio >= 0.9 ? "#f04444" : ratio >= 0.7 ? "#f5a623" : "#3987e5";
  const track = ratio >= 0.9 ? "#3d1a1a" : ratio >= 0.7 ? "#3d2f14" : "#16283d";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className="text-[13px]">
          {format(used)} <span className="text-fg-faint">/ {format(quota)}</span>
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ background: track }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 1.5 : 0)}%`, background: fill }}
        />
      </div>
    </div>
  );
}

export function UsageView({
  plan,
  usage,
  invoices,
}: {
  plan: Plan;
  usage: Usage;
  invoices: Invoice[];
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const otherPlan = plan.id === "hobby" ? "pro" : "hobby";

  async function switchPlan() {
    setSwitching(true);
    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: otherPlan }),
    });
    setSwitching(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[13px] text-fg-muted">Current plan</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{plan.name}</span>
              <span className="text-sm text-fg-muted">
                {plan.pricePerMonth === 0 ? "Free" : `$${plan.pricePerMonth} / month`}
              </span>
            </div>
          </div>
          <Button
            variant={plan.id === "hobby" ? "primary" : "secondary"}
            onClick={switchPlan}
            disabled={switching}
          >
            {switching ? <Spinner className={plan.id === "hobby" ? "text-background" : ""} /> :
              plan.id === "hobby" ? "Upgrade to Pro" : "Downgrade to Hobby"}
          </Button>
        </div>
      </Card>

      {/* Quota meters — trailing 30 days */}
      <Card className="p-6">
        <h2 className="text-sm font-medium">Usage — last 30 days</h2>
        <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <Meter label="Bandwidth" used={usage.bandwidth} quota={plan.quotas.bandwidth} format={bytes} />
          <Meter label="Requests" used={usage.requests} quota={plan.quotas.requests} format={compact} />
          <Meter
            label="Build minutes"
            used={usage.buildMinutes}
            quota={plan.quotas.buildMinutes}
            format={(v) => `${compact(Math.round(v))} min`}
          />
          <Meter label="Projects" used={usage.projects} quota={plan.quotas.projects} format={String} />
          <Meter label="Databases" used={usage.databases} quota={plan.quotas.databases} format={String} />
        </div>
        <p className="mt-5 text-xs text-fg-faint">
          Projects, databases and build minutes are enforced — you&apos;ll be prompted to upgrade when a
          limit is reached.
        </p>
      </Card>

      {/* Per-project breakdown */}
      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">By project</h2>
        </div>
        {usage.perProject.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-fg-muted">No projects yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-fg-muted">
                <tr className="border-b border-edge">
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Requests</th>
                  <th className="px-6 py-3 font-medium">Bandwidth</th>
                  <th className="px-6 py-3 font-medium">Build minutes</th>
                  <th className="px-6 py-3 font-medium">Deployments</th>
                </tr>
              </thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {usage.perProject.map((p) => (
                  <tr key={p.projectId} className="border-b border-edge last:border-0">
                    <td className="px-6 py-3 font-sans font-medium">{p.projectName}</td>
                    <td className="px-6 py-3 text-fg-muted">{compact(p.requests)}</td>
                    <td className="px-6 py-3 text-fg-muted">{bytes(p.bandwidth)}</td>
                    <td className="px-6 py-3 text-fg-muted">{p.buildMinutes}</td>
                    <td className="px-6 py-3 text-fg-muted">{p.deployments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoices */}
      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">Invoices</h2>
        </div>
        <div className="divide-y divide-edge">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-6 py-3.5 text-sm">
              <span className="w-28 font-mono text-xs text-fg-faint">{inv.id}</span>
              <span className="flex-1">{inv.period}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>${inv.amount.toFixed(2)}</span>
              <span
                className={`w-20 text-right text-xs ${
                  inv.status === "paid" ? "text-success" : "text-fg-muted"
                }`}
              >
                {inv.status === "paid" ? "Paid" : "Upcoming"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
