"use client";

import { useMemo, useRef, useState } from "react";
import type { DayMetric } from "@/lib/metrics";
import { Card } from "@/components/ui";

/* Chart colors validated (dataviz six checks) for the dark surface #111112:
   slot 1 blue for requests, slot 2 aqua for bandwidth. Marks wear the series
   color; all text stays in text tokens. */
const SERIES = {
  requests: "#3987e5",
  bandwidth: "#199e70",
};
const GRID = "#232326";
const AXIS_TEXT = "#a1a1aa";

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function bytes(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}

function dayLabel(ts: number): string {
  // Pin UTC so the SSR render and the client hydration agree (the sample data is
  // bucketed by UTC day) — otherwise viewers west of the server shift a day.
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Round up to a clean axis maximum (1/2/5 × 10^k). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}

// ---------- stat tile ----------

function StatTile({
  label,
  value,
  delta,
  upIsGood = true,
}: {
  label: string;
  value: string;
  delta: number | null;
  upIsGood?: boolean;
}) {
  const good = delta != null && (delta >= 0) === upIsGood;
  return (
    <Card className="p-5">
      <div className="text-[13px] text-fg-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
      {delta != null && (
        <div className={`mt-1 text-xs ${good ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs previous period
        </div>
      )}
    </Card>
  );
}

// ---------- time-series chart (line + wash, crosshair tooltip) ----------

function TimeSeriesChart({
  title,
  data,
  color,
  format,
}: {
  title: string;
  data: { ts: number; value: number }[];
  color: string;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 720;
  const H = 220;
  const PAD = { top: 12, right: 12, bottom: 26, left: 46 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const x = (i: number) => PAD.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const areaPath = `${linePath}L${x(data.length - 1).toFixed(1)},${(PAD.top + ih).toFixed(1)}L${x(0).toFixed(1)},${(PAD.top + ih).toFixed(1)}Z`;

  const yTicks = [0, max / 2, max];
  // ~5 x labels, evenly sampled
  const xTickEvery = Math.max(1, Math.round(data.length / 5));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = Math.min(1, Math.max(0, (px - PAD.left) / iw));
    setHover(Math.round(t * (data.length - 1)));
  }

  const h = hover != null ? data[hover] : null;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full cursor-crosshair"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={title}
        >
          {/* hairline gridlines */}
          {yTicks.map((t) => (
            <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          ))}
          {/* y tick labels — clean numbers, text tokens */}
          {yTicks.map((t) => (
            <text
              key={`l${t}`}
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="11"
              fill={AXIS_TEXT}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format(t)}
            </text>
          ))}
          {/* x tick labels */}
          {data.map((d, i) =>
            i % xTickEvery === 0 ? (
              <text key={d.ts} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                {dayLabel(d.ts)}
              </text>
            ) : null
          )}
          {/* area wash ~10% + 2px line */}
          <path d={areaPath} fill={color} opacity="0.1" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* crosshair + marker with surface ring */}
          {h && hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke={GRID} strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h.value)} r="5" fill={color} stroke="#111112" strokeWidth="2" />
            </>
          )}
        </svg>

        {/* tooltip: value leads, label follows */}
        {h && hover != null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md border border-edge-strong bg-background px-3 py-1.5 shadow-lg shadow-black/40"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <div className="whitespace-nowrap text-sm font-semibold">{format(h.value)}</div>
            <div className="whitespace-nowrap text-[11px] text-fg-muted">{dayLabel(h.ts)}</div>
          </div>
        )}
      </div>

      {/* table view — every plotted value reachable without hover */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-fg-faint hover:text-fg-muted">
          View data as table
        </summary>
        <div className="log-scroll mt-2 max-h-48 overflow-y-auto rounded-md border border-edge">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-fg-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Date</th>
                <th className="px-3 py-1.5 font-medium">{title}</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {[...data].reverse().map((d) => (
                <tr key={d.ts} className="border-t border-edge">
                  <td className="px-3 py-1.5 text-fg-muted">{dayLabel(d.ts)}</td>
                  <td className="px-3 py-1.5">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

// ---------- dashboard ----------

export function AnalyticsDashboard({ metrics }: { metrics: DayMetric[] }) {
  const [days, setDays] = useState(30);

  const { window, prev } = useMemo(() => {
    return {
      window: metrics.slice(metrics.length - days),
      prev: metrics.slice(metrics.length - days * 2, metrics.length - days),
    };
  }, [metrics, days]);

  const sum = (rows: DayMetric[], k: "requests" | "bandwidth" | "errors") =>
    rows.reduce((a, r) => a + r[k], 0);

  const delta = (cur: number, before: number): number | null =>
    before > 0 ? ((cur - before) / before) * 100 : null;

  const reqs = sum(window, "requests");
  const bw = sum(window, "bandwidth");
  const errs = sum(window, "errors");
  const errRate = reqs > 0 ? (errs / reqs) * 100 : 0;
  const prevReqs = sum(prev, "requests");
  const prevBw = sum(prev, "bandwidth");
  const prevErrRate = prevReqs > 0 ? (sum(prev, "errors") / prevReqs) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* date-range filter: one row, above everything it scopes */}
      <div className="flex items-center gap-1 rounded-lg border border-edge bg-surface p-1 w-fit">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] transition-colors ${
              days === r.days ? "bg-surface-hover text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Requests" value={compact(reqs)} delta={delta(reqs, prevReqs)} />
        <StatTile label="Bandwidth" value={bytes(bw)} delta={delta(bw, prevBw)} />
        <StatTile
          label="Error rate"
          value={`${errRate.toFixed(2)}%`}
          delta={prevErrRate > 0 ? errRate - prevErrRate : null}
          upIsGood={false}
        />
      </div>

      <TimeSeriesChart
        title="Requests"
        color={SERIES.requests}
        data={window.map((d) => ({ ts: d.ts, value: d.requests }))}
        format={compact}
      />
      <TimeSeriesChart
        title="Bandwidth"
        color={SERIES.bandwidth}
        data={window.map((d) => ({ ts: d.ts, value: d.bandwidth }))}
        format={bytes}
      />
    </div>
  );
}
