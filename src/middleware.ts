import { NextResponse, type NextRequest } from "next/server";
import { parseTraceparent, newTraceId, newSpanId, formatTraceparent } from "@/lib/trace";

/**
 * Assign a W3C trace context to every request. Reuse an inbound `traceparent`
 * when present (so a trace started upstream continues), otherwise mint one.
 * The trace id is threaded to route handlers via `x-trace-id` and echoed on the
 * response so it can be quoted to find every log line for the request.
 */
export function middleware(req: NextRequest) {
  const incoming = parseTraceparent(req.headers.get("traceparent"));
  const traceId = incoming?.traceId ?? newTraceId();
  const spanId = newSpanId();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-trace-id", traceId);
  requestHeaders.set("traceparent", formatTraceparent(traceId, spanId));

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-trace-id", traceId);
  return res;
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
};
