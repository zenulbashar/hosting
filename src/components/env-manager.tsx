"use client";

import { useState } from "react";
import type { EnvVar } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

const TARGETS = ["production", "preview", "development"] as const;

export function EnvManager({ projectId, initial }: { projectId: string; initial: EnvVar[] }) {
  const [vars, setVars] = useState(initial);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [targets, setTargets] = useState<string[]>([...TARGETS]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch(`/api/projects/${projectId}/env`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value, targets }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add variable");
      return;
    }
    setVars((prev) => [data.env, ...prev]);
    setKey("");
    setValue("");
    setTargets([...TARGETS]);
  }

  async function remove(envId: string) {
    setVars((prev) => prev.filter((v) => v.id !== envId));
    await fetch(`/api/projects/${projectId}/env/${envId}`, { method: "DELETE" });
  }

  function toggleTarget(t: string) {
    setTargets((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-medium">Add New</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          Variables are encrypted at rest and exposed to your builds and runtime
          for the environments you select.
        </p>
        <form onSubmit={add} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="env-key">Key</Label>
              <Input
                id="env-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="API_URL"
                className="font-mono"
                required
              />
            </div>
            <div>
              <Label htmlFor="env-value">Value</Label>
              <Input
                id="env-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://api.example.com"
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {TARGETS.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 text-sm capitalize text-fg-muted">
                <input
                  type="checkbox"
                  checked={targets.includes(t)}
                  onChange={() => toggleTarget(t)}
                  className="h-4 w-4 accent-[#0070f3]"
                />
                {t}
              </label>
            ))}
            <div className="ml-auto">
              <Button type="submit" size="sm" disabled={pending || !key}>
                {pending ? <Spinner className="text-background" /> : "Save"}
              </Button>
            </div>
          </div>
          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">
            All Variables <span className="ml-1 text-fg-faint">({vars.length})</span>
          </h2>
        </div>
        {vars.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-fg-muted">
            No environment variables yet.
          </p>
        ) : (
          <div className="divide-y divide-edge">
            {vars.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[13px]">{v.key}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-fg-faint">
                    {v.targets.split(",").map((t) => (
                      <span key={t} className="rounded-full border border-edge-strong px-2 py-0.5 capitalize">
                        {t}
                      </span>
                    ))}
                    <span>Added {timeAgo(v.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleReveal(v.id)}
                  className="max-w-[200px] cursor-pointer truncate rounded bg-background px-2.5 py-1 font-mono text-xs text-fg-muted hover:text-fg"
                  title={revealed.has(v.id) ? "Hide value" : "Reveal value"}
                >
                  {revealed.has(v.id) ? v.value || "(empty)" : "••••••••"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => remove(v.id)} aria-label={`Delete ${v.key}`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" />
                  </svg>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
