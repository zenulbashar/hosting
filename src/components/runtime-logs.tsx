"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";

type LogEntry = {
  id: number;
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
};

const SITE_PATHS = ["/", "/about", "/pricing", "/blog/launch", "/api/health", "/api/products", "/contact", "/docs"];
const AGENT_TASKS = ["summarize-inbox", "research-request", "draft-reply", "crm-sync", "triage-ticket", "generate-report"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeSiteLine(region: string): Omit<LogEntry, "id" | "ts"> {
  const r = Math.random();
  if (r < 0.02) {
    return { level: "error", message: `GET ${pick(SITE_PATHS)} 500 ${Math.floor(Math.random() * 300 + 100)}ms · ${region} · unhandled exception` };
  }
  if (r < 0.06) {
    return { level: "warn", message: `GET /${Math.random().toString(36).slice(2, 8)} 404 ${Math.floor(Math.random() * 20 + 2)}ms · ${region}` };
  }
  const status = Math.random() < 0.25 ? 304 : 200;
  return { level: "info", message: `GET ${pick(SITE_PATHS)} ${status} ${Math.floor(Math.random() * 60 + 3)}ms · ${region} · cache ${Math.random() < 0.6 ? "HIT" : "MISS"}` };
}

function makeAgentLine(region: string): Omit<LogEntry, "id" | "ts"> {
  const r = Math.random();
  if (r < 0.03) {
    return { level: "error", message: `task failed: ${pick(AGENT_TASKS)} — upstream LLM timeout after 30s, retrying (1/3)` };
  }
  if (r < 0.15) {
    return { level: "info", message: `heartbeat ok — memory ${Math.floor(Math.random() * 200 + 220)} MB, cpu ${Math.floor(Math.random() * 12 + 1)}% · ${region}` };
  }
  if (r < 0.4) {
    return { level: "info", message: `task queued from webhook: ${pick(AGENT_TASKS)}` };
  }
  return {
    level: "info",
    message: `task completed: ${pick(AGENT_TASKS)} (${(Math.random() * 20 + 1).toFixed(1)}s, ${(Math.random() * 60 + 2).toFixed(1)}k tokens)`,
  };
}

/**
 * Simulated live runtime stream (request logs for sites, task/heartbeat logs
 * for agents). Replaced by real ingestion when the datacenter exists.
 */
export function RuntimeLogs({ kind, region }: { kind: "site" | "agent"; region: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | "warn" | "error">("all");
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed with a backlog, then stream.
  useEffect(() => {
    const make = kind === "agent" ? makeAgentLine : makeSiteLine;
    const seed: LogEntry[] = [];
    let t = Date.now() - 1000 * 60 * 5;
    for (let i = 0; i < 40; i++) {
      t += Math.random() * 8000;
      seed.push({ id: nextId.current++, ts: t, ...make(region) });
    }
    setLogs(seed);
  }, [kind, region]);

  useEffect(() => {
    if (paused) return;
    const make = kind === "agent" ? makeAgentLine : makeSiteLine;
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      setLogs((prev) => {
        const next = [...prev, { id: nextId.current++, ts: Date.now(), ...make(region) }];
        return next.length > 500 ? next.slice(-500) : next;
      });
      timer = setTimeout(tick, Math.random() * 2200 + 400);
    }
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, [paused, kind, region]);

  useEffect(() => {
    if (scrollRef.current && !paused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const visible = filter === "all" ? logs : logs.filter((l) => (filter === "warn" ? l.level !== "info" : l.level === "error"));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-sm font-medium">
          Runtime Logs
          {!paused && <span className="h-2 w-2 animate-pulse-dot rounded-full bg-success" />}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-edge p-0.5 text-xs">
            {(["all", "warn", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`cursor-pointer rounded px-2 py-1 capitalize transition-colors ${
                  filter === f ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {f === "all" ? "All" : f === "warn" ? "Warnings+" : "Errors"}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
            Clear
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="log-scroll h-[520px] overflow-y-auto bg-[#0c0c0e] px-5 py-4 font-mono text-[12.5px] leading-[1.75]"
      >
        {visible.length === 0 ? (
          <p className="text-fg-faint">No log lines{filter !== "all" ? " at this level" : ""} yet…</p>
        ) : (
          visible.map((line) => (
            <div key={line.id} className="flex gap-4 whitespace-pre-wrap">
              <span className="shrink-0 select-none text-fg-faint">
                {new Date(line.ts).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span
                className={
                  line.level === "error" ? "text-danger" : line.level === "warn" ? "text-warning" : "text-fg-muted"
                }
              >
                {line.message}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
