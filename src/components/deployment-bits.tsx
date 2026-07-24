"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Deployment } from "@/lib/data";
import { deploymentUrl, formatDuration, IN_FLIGHT, timeAgo } from "@/lib/format";
import { Badge, Button, Spinner, StatusDot } from "@/components/ui";

/** Re-render the current server component tree on an interval while `active`. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}

export function RedeployButton({
  projectId,
  variant = "secondary",
  label = "Redeploy",
  environment = "production",
}: {
  projectId: string;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  environment?: "production" | "preview";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeploy() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/projects/${projectId}/deployments/${data.deployment.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Deployment failed to start");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={variant} size="sm" onClick={redeploy} disabled={pending}>
        {pending ? <Spinner /> : label}
      </Button>
      {error && <span className="max-w-xs text-right text-xs text-danger">{error}</span>}
    </div>
  );
}

export function VisitButton({ urlSlug, size = "sm" }: { urlSlug: string; size?: "sm" | "md" }) {
  return (
    <a
      href={`/preview/${urlSlug}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-fg font-medium text-background transition-colors hover:bg-fg/85 ${
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm"
      }`}
    >
      Visit
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function DeploymentRow({
  deployment,
  projectId,
}: {
  deployment: Deployment;
  projectId: string;
}) {
  return (
    <Link
      href={`/projects/${projectId}/deployments/${deployment.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,2fr)_auto]"
    >
      <div className="min-w-0">
        <div className="truncate font-mono text-[13px] text-fg">
          {deployment.url_slug}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Badge tone={deployment.environment === "production" ? "accent" : "default"}>
            {deployment.environment === "production" ? "Production" : "Preview"}
          </Badge>
          {deployment.is_current === 1 && <Badge tone="success">Current</Badge>}
        </div>
      </div>

      <div className="hidden sm:block">
        <StatusDot status={deployment.status} />
        <div className="mt-1 text-xs text-fg-faint">
          {deployment.duration_ms != null ? formatDuration(deployment.duration_ms) : "—"}
        </div>
      </div>

      <div className="hidden min-w-0 sm:block">
        <div className="truncate text-[13px]">{deployment.commit_msg}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-fg-faint">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3v12M6 15a3 3 0 103 3M6 15a9 9 0 009-9 3 3 0 10-3-3" strokeLinecap="round" />
          </svg>
          <span className="font-mono">{deployment.branch}</span>
          <span className="font-mono">{deployment.commit_sha.slice(0, 7)}</span>
        </div>
      </div>

      <div className="text-right text-xs text-fg-faint">
        <span className="sm:hidden">
          <StatusDot status={deployment.status} withLabel={false} />
        </span>
        <div>{timeAgo(deployment.created_at)}</div>
      </div>
    </Link>
  );
}

/** Client list that polls while any deployment is in flight. */
export function DeploymentsList({
  initial,
  projectId,
}: {
  initial: Deployment[];
  projectId: string;
}) {
  const [deployments, setDeployments] = useState(initial);
  const anyInFlight = deployments.some((d) => IN_FLIGHT.has(d.status));

  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/projects/${projectId}/deployments`);
      if (res.ok) setDeployments((await res.json()).deployments);
    }, 3000);
    return () => clearInterval(t);
  }, [anyInFlight, projectId]);

  if (deployments.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-fg-muted">
        No deployments yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-edge">
      {deployments.map((d) => (
        <DeploymentRow key={d.id} deployment={d} projectId={projectId} />
      ))}
    </div>
  );
}

export { deploymentUrl };
