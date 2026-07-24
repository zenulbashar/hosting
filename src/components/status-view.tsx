"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";

type RegionRow = {
  region: string;
  status: "operational" | "degraded" | "down";
  latency_ms: number;
  meta: { id: string; city: string; country: string; label: string; flag: string };
  deployments: number;
};

const STATUS_TONE = {
  operational: "success",
  degraded: "warning",
  down: "danger",
} as const;

const NEXT_ACTIONS: { label: string; status: RegionRow["status"] }[] = [
  { label: "Operational", status: "operational" },
  { label: "Degraded", status: "degraded" },
  { label: "Down", status: "down" },
];

export function StatusView({ initial, canManage = false }: { initial: RegionRow[]; canManage?: boolean }) {
  const [regions, setRegions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(region: string, status: RegionRow["status"]) {
    setBusy(region);
    const res = await fetch(`/api/regions/${region}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && data.regions) {
      // Merge health back in, preserving deployment counts from initial load.
      setRegions((prev) =>
        prev.map((p) => {
          const updated = data.regions.find((r: RegionRow) => r.region === p.region);
          return updated ? { ...p, status: updated.status, latency_ms: updated.latency_ms } : p;
        })
      );
    }
  }

  const healthy = regions.filter((r) => r.status === "operational").length;
  const allOk = healthy === regions.length;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm font-medium">Global edge</div>
          <div className="mt-0.5 text-[13px] text-fg-muted">
            {healthy}/{regions.length} regions operational
          </div>
        </div>
        <Badge tone={allOk ? "success" : "warning"}>
          {allOk ? "All systems operational" : "Degraded — failover active"}
        </Badge>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">Regions</h2>
          <p className="mt-1 text-xs text-fg-faint">
            {canManage
              ? "Change a region's status to simulate an outage — new deployments skip it and live traffic fails over to the next healthy region."
              : "Live health of the Zale global edge. Region status is managed by platform operators."}
          </p>
        </div>
        <div className="divide-y divide-edge">
          {regions.map((r) => (
            <div key={r.region} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{r.meta.flag}</span>
                  <span className="text-sm">{r.meta.city}</span>
                  <span className="font-mono text-xs text-fg-faint">{r.region}</span>
                </div>
                <div className="mt-1 text-xs text-fg-faint">
                  {r.latency_ms} ms · {r.deployments} deployment{r.deployments === 1 ? "" : "s"}
                </div>
              </div>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              {canManage && (
                <div className="flex gap-1">
                  {NEXT_ACTIONS.map((a) => (
                    <button
                      key={a.status}
                      onClick={() => setStatus(r.region, a.status)}
                      disabled={busy === r.region || r.status === a.status}
                      className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-default ${
                        r.status === a.status
                          ? "border-edge-strong text-fg"
                          : "border-edge text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-50"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
