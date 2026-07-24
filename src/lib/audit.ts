/**
 * Tamper-evident audit log.
 *
 * Every security-sensitive action appends a row whose `hash` is
 * `sha256(prev_hash + "\n" + canonical(entry))`, chaining the previous row's
 * hash. This makes the log append-only in effect: editing a field, deleting a
 * row, or reordering rows changes a hash and breaks every link after it, which
 * `verifyAuditChain` detects and pinpoints. It's the same construction as a
 * blockchain's block links, scoped to one table.
 *
 * Appends are serialized in-process so concurrent writers can't fork the chain
 * on a stale "last hash". Across multiple replicas the serialization point moves
 * to the database (a SERIALIZABLE transaction or advisory lock around the
 * read-tail-then-insert) — that's the one change needed to scale this out.
 */
import crypto from "node:crypto";
import { db } from "./db";

const GENESIS = "0".repeat(64);

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

type Chainable = {
  ts: number;
  actor_id: string | null;
  actor: string;
  action: string;
  target: string | null;
  trace_id: string | null;
  metadata: string | null;
};

/** Deterministic serialization of the hashed fields. Order and null-handling
 *  must match exactly between append and verify. */
function canonical(e: Chainable): string {
  return JSON.stringify([
    e.ts,
    e.actor_id ?? "",
    e.actor,
    e.action,
    e.target ?? "",
    e.trace_id ?? "",
    e.metadata ?? "",
  ]);
}

// In-process append serialization: chain each append after the previous one so
// two concurrent writers can't both read the same tail hash.
let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function currentTraceId(): Promise<string | null> {
  try {
    // Lazy import so this module stays usable outside a Next request runtime.
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("x-trace-id");
  } catch {
    return null; // not in a request scope
  }
}

export type AuditInput = {
  actorId?: string | null;
  actor: string;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  const trace_id = await currentTraceId();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  await serialize(async () => {
    const last = await db
      .prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1")
      .get<{ hash: string }>();
    const prev_hash = last?.hash ?? GENESIS;
    const entry: Chainable = {
      ts: Date.now(),
      actor_id: input.actorId ?? null,
      actor: input.actor,
      action: input.action,
      target: input.target ?? null,
      trace_id,
      metadata,
    };
    const hash = sha256(prev_hash + "\n" + canonical(entry));
    await db
      .prepare(
        "INSERT INTO audit_log (ts, actor_id, actor, action, target, trace_id, metadata, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(entry.ts, entry.actor_id, entry.actor, entry.action, entry.target, entry.trace_id, entry.metadata, prev_hash, hash);
  });
}

export type AuditEntry = Chainable & {
  id: number;
  prev_hash: string;
  hash: string;
};

/** An actor's own audit trail, newest first. */
export function listAudit(actorId: string, limit = 100): Promise<AuditEntry[]> {
  return db
    .prepare("SELECT * FROM audit_log WHERE actor_id = ? ORDER BY id DESC LIMIT ?")
    .all<AuditEntry>(actorId, limit);
}

export type ChainVerification = { ok: boolean; count: number; brokenAt?: number; reason?: string };

/** Recompute the whole chain and report the first break, if any. */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const rows = await db.prepare("SELECT * FROM audit_log ORDER BY id ASC").all<AuditEntry>();
  let prev = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== prev) {
      return { ok: false, count: rows.length, brokenAt: r.id, reason: "prev_hash discontinuity" };
    }
    const expected = sha256(r.prev_hash + "\n" + canonical(r));
    if (r.hash !== expected) {
      return { ok: false, count: rows.length, brokenAt: r.id, reason: "hash mismatch" };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}
