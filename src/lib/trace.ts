/**
 * W3C Trace Context (https://www.w3.org/TR/trace-context/) — the wire format
 * OpenTelemetry uses to correlate work across services.
 *
 * The middleware assigns a trace id to every request (reusing an inbound
 * `traceparent` when a caller already started the trace), threads it down to
 * route handlers via an `x-trace-id` request header, and echoes it back on the
 * response so a client or support engineer can quote one id to find every log
 * line for that request. Audit entries capture the same id. To ship spans to a
 * real backend, forward them to an OTLP collector — the ids already conform.
 *
 * Deliberately dependency-free and Web-Crypto only, so it runs on the edge
 * runtime (middleware) as well as Node.
 */

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = "";
  for (const b of a) s += b.toString(16).padStart(2, "0");
  return s;
}

/** 16-byte trace id (32 hex chars). */
export function newTraceId(): string {
  return randomHex(16);
}

/** 8-byte span id (16 hex chars). */
export function newSpanId(): string {
  return randomHex(8);
}

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function parseTraceparent(header: string | null): { traceId: string; spanId: string } | null {
  if (!header) return null;
  const m = TRACEPARENT_RE.exec(header.trim().toLowerCase());
  if (!m) return null;
  // All-zero ids are invalid per spec.
  if (m[1] === "0".repeat(32) || m[2] === "0".repeat(16)) return null;
  return { traceId: m[1], spanId: m[2] };
}

export function formatTraceparent(traceId: string, spanId: string, sampled = true): string {
  return `00-${traceId}-${spanId}-${sampled ? "01" : "00"}`;
}
