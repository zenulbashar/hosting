"use client";

import { useState } from "react";
import type { DeployHook } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

export function HooksManager({ projectId, initial }: { projectId: string; initial: DeployHook[] }) {
  const [hooks, setHooks] = useState(initial);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function hookUrl(token: string): string {
    return `${window.location.origin}/api/hooks/${token}`;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch(`/api/projects/${projectId}/hooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, branch }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create hook");
      return;
    }
    setHooks((prev) => [data.hook, ...prev]);
    setName("");
    setBranch("main");
  }

  async function remove(hookId: string) {
    setHooks((prev) => prev.filter((h) => h.id !== hookId));
    await fetch(`/api/projects/${projectId}/hooks/${hookId}`, { method: "DELETE" });
  }

  async function copy(hook: DeployHook) {
    await navigator.clipboard.writeText(hookUrl(hook.token));
    setCopied(hook.id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <h2 className="text-base font-medium">Deploy Hooks</h2>
        <p className="mt-1 max-w-lg text-[13px] text-fg-muted">
          A deploy hook is a URL that triggers a new production deployment when
          it receives a request — point your git provider&apos;s webhook or CI at it.
        </p>

        <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Label htmlFor="hook-name">Hook name</Label>
            <Input
              id="hook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="github-main"
              required
            />
          </div>
          <div className="w-40">
            <Label htmlFor="hook-branch">Branch</Label>
            <Input
              id="hook-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="font-mono"
            />
          </div>
          <Button type="submit" disabled={pending || !name}>
            {pending ? <Spinner className="text-background" /> : "Create Hook"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>

      {hooks.length > 0 && (
        <div className="divide-y divide-edge border-t border-edge">
          {hooks.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {h.name}
                  <span className="rounded-full border border-edge-strong px-2 py-0.5 font-mono text-[11px] font-normal text-fg-muted">
                    {h.branch}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-xs text-fg-faint">
                  /api/hooks/{h.token.slice(0, 12)}…
                </div>
                <div className="mt-0.5 text-xs text-fg-faint">Created {timeAgo(h.created_at)}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => copy(h)}>
                {copied === h.id ? "Copied!" : "Copy URL"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(h.id)} aria-label={`Delete ${h.name}`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
