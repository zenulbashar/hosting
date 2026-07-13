"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Deployment, LogLine } from "@/lib/data";
import { deploymentUrl, formatDuration, IN_FLIGHT, timeAgo } from "@/lib/format";
import { Badge, Button, Card, Spinner, StatusDot } from "@/components/ui";
import { RedeployButton, VisitButton } from "@/components/deployment-bits";

export function DeploymentView({
  initial,
  initialLogs,
  projectId,
}: {
  initial: Deployment;
  initialLogs: LogLine[];
  projectId: string;
}) {
  const [deployment, setDeployment] = useState(initial);
  const [logs, setLogs] = useState<LogLine[]>(initialLogs);
  const [canceling, setCanceling] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLogId = logs.length > 0 ? logs[logs.length - 1].id : 0;
  const inFlight = IN_FLIGHT.has(deployment.status);

  // Poll for status + new log lines while the deployment is running.
  useEffect(() => {
    if (!inFlight) return;
    let stop = false;
    const t = setInterval(async () => {
      const res = await fetch(`/api/deployments/${deployment.id}?after=${lastLogId}`);
      if (!res.ok || stop) return;
      const data = await res.json();
      setDeployment(data.deployment);
      if (data.logs.length > 0) setLogs((prev) => [...prev, ...data.logs]);
    }, 1200);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [inFlight, deployment.id, lastLogId]);

  // Auto-scroll the log pane unless the user scrolled up.
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(nearBottom);
  }, []);

  async function cancel() {
    setCanceling(true);
    await fetch(`/api/deployments/${deployment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  }

  async function promote() {
    setPromoting(true);
    const res = await fetch(`/api/deployments/${deployment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "promote" }),
    });
    if (res.ok) {
      const data = await res.json();
      setDeployment(data.deployment);
    }
    setPromoting(false);
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate font-mono text-lg">{deploymentUrl(deployment.url_slug)}</h1>
              <Badge tone={deployment.environment === "production" ? "accent" : "default"}>
                {deployment.environment === "production" ? "Production" : "Preview"}
              </Badge>
              {deployment.is_current === 1 && <Badge tone="success">Current</Badge>}
            </div>
            <p className="mt-1.5 truncate text-sm text-fg-muted">
              {deployment.commit_msg}
              <span className="ml-2 font-mono text-xs text-fg-faint">
                {deployment.branch} · {deployment.commit_sha.slice(0, 7)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {inFlight && (
              <Button variant="secondary" size="sm" onClick={cancel} disabled={canceling}>
                {canceling ? <Spinner /> : "Cancel"}
              </Button>
            )}
            {deployment.status === "READY" && deployment.is_current !== 1 && (
              <Button variant="secondary" size="sm" onClick={promote} disabled={promoting}>
                {promoting ? <Spinner /> : "Promote to Production"}
              </Button>
            )}
            {deployment.status === "READY" && <VisitButton urlSlug={deployment.url_slug} />}
            {(deployment.status === "ERROR" || deployment.status === "CANCELED") && (
              <RedeployButton projectId={projectId} variant="primary" label="Retry Deployment" />
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-edge pt-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-faint">Status</dt>
            <dd className="mt-1.5"><StatusDot status={deployment.status} /></dd>
          </div>
          <div>
            <dt className="text-xs text-fg-faint">Environment</dt>
            <dd className="mt-1.5 capitalize">{deployment.environment}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-faint">Duration</dt>
            <dd className="mt-1.5">
              {deployment.duration_ms != null
                ? formatDuration(deployment.duration_ms)
                : inFlight
                  ? "Running…"
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-faint">Created</dt>
            <dd className="mt-1.5">{timeAgo(deployment.created_at)}</dd>
          </div>
        </dl>
      </Card>

      {/* Build logs */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-sm font-medium">
            Build Logs
            {inFlight && <Spinner />}
          </h2>
          <span className="text-xs text-fg-faint">{logs.length} lines</span>
        </div>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="log-scroll max-h-[480px] min-h-[240px] overflow-y-auto bg-[#0c0c0e] px-5 py-4 font-mono text-[12.5px] leading-[1.7]"
        >
          {logs.length === 0 ? (
            <p className="text-fg-faint">Waiting for logs…</p>
          ) : (
            logs.map((line) => (
              <div key={line.id} className="flex gap-4 whitespace-pre-wrap">
                <span className="shrink-0 select-none text-fg-faint">
                  {new Date(line.ts).toLocaleTimeString("en-US", { hour12: false })}
                </span>
                <span
                  className={
                    line.level === "error"
                      ? "text-danger"
                      : line.level === "warn"
                        ? "text-warning"
                        : "text-fg-muted"
                  }
                >
                  {line.message}
                </span>
              </div>
            ))
          )}
          {inFlight && <span className="mt-1 inline-block h-4 w-2 animate-pulse-dot bg-fg-muted" />}
        </div>
      </Card>
    </div>
  );
}
