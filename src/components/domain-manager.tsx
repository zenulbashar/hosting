"use client";

import { useState } from "react";
import type { Domain } from "@/lib/data";
import { Badge, Button, Card, Input, Spinner } from "@/components/ui";

export function DomainManager({
  projectId,
  projectSlug,
  initial,
}: {
  projectId: string;
  projectSlug: string;
  initial: Domain[];
}) {
  const [domains, setDomains] = useState(initial);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch(`/api/projects/${projectId}/domains`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add domain");
      return;
    }
    setDomains((prev) => [...prev, data.domain]);
    setName("");
  }

  async function verify(domainId: string) {
    setVerifying(domainId);
    // Simulated DNS check: the platform confirms the records instantly.
    await new Promise((r) => setTimeout(r, 1200));
    const res = await fetch(`/api/projects/${projectId}/domains/${domainId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "verify" }),
    });
    if (res.ok) {
      setDomains((prev) => prev.map((d) => (d.id === domainId ? { ...d, verified: 1 } : d)));
    }
    setVerifying(null);
  }

  async function remove(domainId: string) {
    setDomains((prev) => prev.filter((d) => d.id !== domainId));
    await fetch(`/api/projects/${projectId}/domains/${domainId}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-medium">Add Domain</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          Point your domain&apos;s A record to <span className="font-mono text-fg">76.223.87.10</span> or
          CNAME to <span className="font-mono text-fg">cname.nimbus.app</span>, then verify.
        </p>
        <form onSubmit={add} className="mt-4 flex gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="app.example.com"
            className="font-mono"
            required
          />
          <Button type="submit" disabled={pending || !name} className="shrink-0">
            {pending ? <Spinner className="text-background" /> : "Add"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">Assigned Domains</h2>
        </div>
        <div className="divide-y divide-edge">
          {/* Default platform subdomain — always present, always verified */}
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[13px]">{projectSlug}.nimbus.app</div>
              <div className="mt-1 text-xs text-fg-faint">Default platform subdomain</div>
            </div>
            <Badge tone="success">Valid</Badge>
          </div>

          {domains.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[13px]">{d.name}</div>
                {d.verified === 0 && (
                  <div className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Set the following record on your DNS provider, then click Verify:
                    <div className="mt-1.5 font-mono text-[11px] text-fg-muted">
                      A&nbsp;&nbsp;&nbsp;{d.name}&nbsp;&nbsp;&nbsp;76.223.87.10
                    </div>
                  </div>
                )}
              </div>
              {d.verified === 1 ? (
                <Badge tone="success">Valid</Badge>
              ) : (
                <>
                  <Badge tone="warning">Pending Verification</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => verify(d.id)}
                    disabled={verifying === d.id}
                  >
                    {verifying === d.id ? <Spinner /> : "Verify"}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => remove(d.id)} aria-label={`Remove ${d.name}`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
