"use client";

import { useState } from "react";
import { REGIONS, getRegion } from "@/lib/regions";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";

type Conn = {
  branch: {
    id: string;
    name: string;
    kind: "primary" | "preview";
    deployment_id: string | null;
    created_at: number;
  };
  username: string;
  host: string;
  port: number;
  database: string;
  maskedConnectionString: string;
};

type Db = {
  id: string;
  name: string;
  region: string;
  status: string;
  created_at: number;
  branches: Conn[];
};

const AVAILABLE = REGIONS.filter((r) => r.available);

export function DatabaseManager({
  projectId,
  initial,
  canAdminister = true,
}: {
  projectId: string;
  initial: Db[];
  canAdminister?: boolean;
}) {
  const [databases, setDatabases] = useState<Db[]>(initial);
  const [name, setName] = useState("");
  const [region, setRegion] = useState(AVAILABLE[0]?.id ?? "syd1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyBranch, setBusyBranch] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch(`/api/projects/${projectId}/databases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, region }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create database");
      return;
    }
    setDatabases(data.databases);
    setName("");
  }

  async function reveal(dbId: string, branchId: string) {
    setBusyBranch(branchId);
    const res = await fetch(`/api/projects/${projectId}/databases/${dbId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reveal", branchId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyBranch(null);
    if (res.ok && data.connectionString) {
      setRevealed((prev) => ({ ...prev, [branchId]: data.connectionString }));
    }
  }

  function hide(branchId: string) {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[branchId];
      return next;
    });
  }

  async function copy(branchId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(branchId);
      setTimeout(() => setCopied((c) => (c === branchId ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  async function remove(dbId: string) {
    if (!confirm("Delete this database? All branches and credentials are destroyed. This cannot be undone.")) return;
    setDatabases((prev) => prev.filter((d) => d.id !== dbId));
    await fetch(`/api/projects/${projectId}/databases/${dbId}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      {canAdminister && (
      <Card className="p-6">
        <h2 className="text-sm font-medium">Create Database</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          A managed Zale DB Postgres instance. The primary branch is created instantly; every preview
          deployment automatically forks its own isolated branch with credentials scoped to that branch alone.
        </p>
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="db-name">Name</Label>
            <Input
              id="db-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app-db"
              className="mt-1 font-mono"
              required
            />
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="db-region">Region</Label>
            <Select id="db-region" value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1">
              {AVAILABLE.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.flag} {r.city} ({r.id})
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending || !name} className="shrink-0">
            {pending ? <Spinner className="text-background" /> : "Create Database"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Card>
      )}

      {databases.length === 0 ? (
        <EmptyState
          title="No databases yet"
          description={
            canAdminister
              ? "Create a Zale DB database to give this project managed Postgres with automatic preview branching."
              : "This project has no databases. Only a team owner can provision one."
          }
        />
      ) : (
        databases.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-edge px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{d.name}</span>
                  <Badge tone={d.status === "available" ? "success" : "warning"}>{d.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-fg-faint">
                  {getRegion(d.region).flag} {getRegion(d.region).label} · {d.branches.length} branch
                  {d.branches.length === 1 ? "" : "es"}
                </div>
              </div>
              {canAdminister && (
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                  Delete
                </Button>
              )}
            </div>
            <div className="divide-y divide-edge">
              {d.branches.map((c) => (
                <div key={c.branch.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px]">{c.branch.name}</span>
                    <Badge tone={c.branch.kind === "primary" ? "accent" : "default"}>{c.branch.kind}</Badge>
                    {c.branch.deployment_id && (
                      <span className="text-xs text-fg-faint">
                        bound to deployment {c.branch.deployment_id.slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-edge bg-surface px-3 py-2 font-mono text-[11px] text-fg-muted">
                      {revealed[c.branch.id] ?? c.maskedConnectionString}
                    </code>
                    {revealed[c.branch.id] ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => copy(c.branch.id, revealed[c.branch.id])}>
                          {copied === c.branch.id ? "Copied" : "Copy"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => hide(c.branch.id)}>
                          Hide
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => reveal(d.id, c.branch.id)}
                        disabled={busyBranch === c.branch.id}
                      >
                        {busyBranch === c.branch.id ? <Spinner /> : "Reveal"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
