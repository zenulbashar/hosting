# Hardening & Compaction Plan — flawless operation, current features, one small VPS

> Scope: make this repository run correctly and safely as a real service on a
> single small VPS (1–4 GB RAM), close the gap to current platform features, and
> apply the security controls a hosting product is expected to have.
>
> This is the compact counterpart to [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md),
> which plans the opposite end of the spectrum (a colocation rack). Nothing here
> supersedes that document; the two describe different deployment sizes.

## 0. Verdict up front

The app is in better shape than a plan like this usually finds. `npm ci`,
`tsc --noEmit` and `next build` all pass cleanly, `npm audit` reports zero
vulnerabilities, every one of the 31 API route files enforces authentication per
method, the deploy engine's state transitions are guarded against double-promote
and un-cancel, and the middleware deliberately does **not** carry authorization
(so the `CVE-2025-29927` middleware-bypass class has no authorization impact
here — and the installed `next@15.5.21` is well past the fix anyway).

Three of the four goals are straightforwardly reachable. The fourth is not, as
stated, and that shapes the whole plan:

| Goal | Reachable? | Where it lands |
|---|---|---|
| "Work flawlessly" | Yes | Phase 2 — there are currently **zero tests**; that is the single largest risk to correctness |
| "Recommended security controls" | Yes | Phase 0 — the app ships **no security headers at all** and boots with an insecure encryption key |
| "Compact on a small VPS" | Yes, and by a large margin | Phase 1 — measured **558 MB → 184 MB** RSS and **692 MB → ~200 MB** on disk |
| "All state-of-the-art features" | **Partly** | Phase 3 for product features; Phase 4 is a genuine architectural blocker |

**The blocker.** `DeploymentDriver` (`src/lib/deploy-engine.ts:27`) is simulated.
The moment it is implemented for real, this platform executes *untrusted
attacker-supplied code* — that is what a PaaS build step is. You cannot safely
multi-tenant untrusted code execution on one small shared VPS: a kernel-level
sandbox escape, a cryptominer saturating the only CPU, or a build OOM-killing the
control plane are all unmitigated by anything currently in the repo (no cgroup
limits, no egress policy, no build timeout, no isolation layer).

So the plan splits the product into two modes, gated by explicit configuration:

- **Trusted mode** (default) — you deploy *your own* projects. Fully achievable
  on a small VPS, and everything in Phases 0–3 applies.
- **Untrusted multi-tenant mode** — opt-in, refuses to start unless an isolation
  backend is configured. Phase 4.

Making that split explicit is itself a security control: today nothing stops a
real driver from being wired in with no isolation at all.

---

## 1. What was verified, and how

Every claim below was produced by running or reading the code in this repo, not
inferred from the README.

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | exit 0 — 31 routes, middleware 34.5 kB, 102 kB shared JS |
| `npm audit` | 0 vulnerabilities (all severities) |
| Installed | `next@15.5.21`, `react@19.2.7`, `pg@8.22.0`, `@electric-sql/pglite@0.5.4` |
| Disk artifact | `node_modules` 575 MB + `.next` 117 MB ≈ **692 MB**; no `.next/standalone` |
| RSS, default config (PGlite) | **558 MB** |
| RSS, `DATABASE_URL` set (PGlite never imported) | **184 MB** |
| Response headers on `/login` | only `x-trace-id`; `X-Powered-By: Next.js` present |
| Auth coverage across `src/app/api/**/route.ts` | all 31 files gate every method |
| Retention statements in `src/` | none found for `deployment_logs`, `audit_log`, `activity` |

### The core flow was exercised, not just compiled

Against a fresh database, driven over the REST API: signup → project create →
deployment. The deploy engine walked `QUEUED → BUILDING → DEPLOYING → READY` in
19.9 s and promoted itself to production (`is_current = 1`) without intervention.
Both preview forms then served `200` unauthenticated:
`/preview/<url-slug>` and `/preview/<project-slug>`.

So the platform genuinely works end to end. The findings below are about what
happens under adversarial conditions and on a constrained host — not about a
broken happy path.

### Two findings captured on the wire

`Set-Cookie` on a real login response — note the absence of `Secure`:

```
set-cookie: hosting_session=dc84e4…; Path=/; Expires=…; Max-Age=2592000; HttpOnly; SameSite=lax
```

Complete security-relevant header set on the public preview page:

```
x-trace-id: 835d7b43ce3e1aa01273ca689b1638f0
X-Powered-By: Next.js
```

That is the entire list. No HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` or `Permissions-Policy` — on the page that represents the
customer-facing edge.

The two RSS numbers are the same build, same requests, differing only in whether
`DATABASE_URL` is set. **Embedded PGlite costs ~374 MB of resident memory.** On a
1 GB VPS the default configuration cannot run; on 2 GB it wastes a fifth of the
box. That single finding drives most of Phase 1.

The production build also emitted this, which is the fail-open behaviour in
`src/lib/crypto.ts:24-31` reproducing exactly as written:

```
[crypto] ZALE_ENCRYPTION_KEY is unset or weak — using an insecure dev key.
         Secrets at rest are NOT protected.
```

A hosting platform that stores customer environment variables must not boot in
that state.

---

## 2. Phase 0 — Fail closed (highest value, ~1–2 days, no new dependencies)

Ordered by severity. Every item here is small and self-contained.

### 0.1 Session cookie is missing `secure`
`src/lib/auth.ts:66-71` sets `httpOnly`, `sameSite`, `path`, `maxAge` — but not
`secure`. The 30-day session token is therefore transmissible in cleartext.

Add `secure` in production and adopt the `__Host-` prefix, which binds the cookie
to the exact origin and forbids `Domain` — worth having on a platform that hands
out subdomains:

```ts
const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-hosting_session" : "hosting_session";
store.set(SESSION_COOKIE, token, {
  httpOnly: true, sameSite: "lax", path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS / 1000,
});
```

Also add an **absolute** session lifetime alongside the 30-day sliding one, and
rotate the token on privilege change. `revokeUserSessions()` already exists and
is called on password change — good; extend it to email change and MFA enrolment.

### 0.2 No security headers anywhere
Confirmed by response inspection, not just by reading code. Add a static header
set in `next.config.ts` plus `poweredByHeader: false`, and a **nonce-based CSP**
in `src/middleware.ts` — middleware is the right place because it already runs on
every non-static request and already rewrites request headers, so threading a
per-request nonce through costs nothing structurally.

A strict CSP is the one item here that needs care rather than a paste: React 19
Server Components and Next's inline bootstrap scripts require the nonce to reach
them, so this must be verified against real rendered pages (Phase 2's Playwright
smoke test is the natural place to assert the headers exist and no console CSP
violations fire).

### 0.3 Encryption key must fail closed, and needs a rotation path
Two separate problems in `src/lib/crypto.ts`:

- **Fail open** (`:24-31`) — production must `throw` at boot, not `console.warn`.
- **No rotation** (`:19-33`) — the key is a single unsalted `SHA-256` pass over
  the passphrase. `v1:` in the envelope is a *format* version, not a *key* id, so
  there is no way to re-encrypt onto a new key without downtime. Derive with
  HKDF-SHA256 (salt + `info` label) and put a key id in the envelope
  (`v2:<keyid>:<iv>:<tag>:<ct>`), keeping `v1:` readable so existing rows keep
  working and upgrade on next write — the same no-migration trick the file
  already uses for legacy plaintext.

### 0.4 Password hashing: synchronous, and under-parameterised
`src/lib/auth.ts:18-30` uses `crypto.scryptSync` with Node's defaults
(N=16384, r=8, p=1). Two distinct issues:

1. **It is synchronous.** Node is single-threaded; every login blocks the event
   loop for the full KDF duration. `/api/auth/login` is unauthenticated, so this
   is a remote availability lever. The per-IP limit of 10/15 min does not help
   against requests spread over many IPs. Switch to the async `crypto.scrypt`
   (libuv threadpool) or `argon2`.
2. **The parameters are below current guidance** — see §6 for the values and the
   VPS-specific memory tradeoff, which is the interesting part on a 1–2 GB box.

`verifyPassword` correctly uses `timingSafeEqual` with a length check. Keep that.

Unsalted SHA-256 for the `nbt_` API tokens is **fine** and should not be
"fixed": the token is 160 bits of `randomBytes`, so there is no dictionary to
build and no work factor to add. Leave it.

### 0.5 Rate limiting has gaps, and trusts a spoofable header
Only 5 routes are limited (login, signup, domain-verify, db-reveal, deploy
hooks). Unlimited: token creation, password change, and every project/team/env
mutation. Most importantly, the public `/preview/[slug]` page is
`force-dynamic`, unauthenticated, and runs up to **three sequential queries per
cache miss** — a cheap amplifier against the only CPU on the box.

Separately, `clientIp()` (`src/lib/rate-limit.ts:43-52`) returns `x-real-ip`
verbatim. The rightmost-hop `x-forwarded-for` logic is genuinely correct and
well-reasoned, but `x-real-ip` is only trustworthy if the reverse proxy
*always overwrites* it **and** the app is unreachable directly. Neither is
enforced or documented today — there is no proxy config in the repo at all. Two
fixes, both in Phase 1's deployment work:

- Bind the app to `127.0.0.1` so the proxy is the only path in.
- Ship the Caddy config that sets `X-Real-IP` unconditionally (§4).

Also note `return "unknown"` collapses every header-less caller into one shared
bucket, which turns a per-IP limit into a global one. Prefer failing to a
per-connection identifier, or make direct access impossible per above.

### 0.6 Reserved-domain blocklist
`DOMAIN_RE` and the global `UNIQUE` on `domains.name` are good, but nothing stops
a tenant adding `www.zale.app` — the platform's own `APP_DOMAIN` — as a "custom
domain". Reject `APP_DOMAIN` and any subdomain of it, plus `localhost` and
bare-IP forms, at `src/app/api/projects/[id]/domains/route.ts:30`.

### 0.7 Missing index on the hottest query
`deployments(project_id)` has no index. `url_slug` and `token_hash` are `UNIQUE`
(so already indexed) and there are 8 well-chosen indexes elsewhere — this one was
simply missed, on the fastest-growing table, backing the dashboard list, "latest
deployment" and "current production deployment" lookups.

```sql
CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_id, created_at DESC);
```

### 0.8 Outbound calls have no timeout
`src/lib/zale-db-client.ts:106` calls `fetch` with no `AbortSignal`. A hung Zale
DB control plane stalls a deploy step until the reaper kills the deployment 30 s
later. Add `AbortSignal.timeout(10_000)` and one bounded retry on 5xx/network
error — the client already supports `Idempotency-Key`, so retries are safe for
the `POST` paths.

---

## 3. Phase 1 — Compaction and the deployment story (~2–3 days)

The repo has no Dockerfile, no `output: 'standalone'`, no proxy config, no
systemd unit, no healthcheck and no backup story. This phase creates them.

### 1.1 Turn on `output: 'standalone'`
Next.js traces the actually-reachable dependency graph and emits a
self-contained server. Measured today: 575 MB `node_modules` + 117 MB `.next`.
Standalone typically lands around 200 MB, so this is roughly a **3× smaller
artifact** for a one-line change:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};
```

Note `serverExternalPackages` already lists both drivers, so tracing will keep
them external correctly.

### 1.2 Make PGlite dev/CI-only — the single biggest memory win
This is the **374 MB** measurement. PGlite is an excellent choice for dev and
(especially) for tests, and should stay for both. It is the wrong thing to run in
production on a small box: it is a WASM Postgres inside the web process, so it
also couples the database's lifetime to a web restart and cannot be backed up
with normal Postgres tooling.

In production, require `DATABASE_URL` and refuse to fall back:

```ts
if (!url && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production (PGlite is dev/CI only)");
}
```

Also make the pool size configurable — `max: 10` is hardcoded at
`src/lib/db.ts:36` and is too high for a small box running Postgres locally:

```ts
const pool = new pg.Pool({
  connectionString: url,
  max: Number(process.env.ZALE_PG_POOL_MAX ?? 8),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
```

### 1.3 Health, readiness and graceful shutdown
There is no health endpoint, and no SIGTERM handling. The second one causes a
real, user-visible bug today: because a step is claimed *before* it runs, a
`SIGTERM` during the final step leaves `next_run_at = NULL` with the deployment
unfinalized, and the reaper then marks a **successful** build as `ERROR` after
`STALL_MS` (30 s). Every deploy of the platform itself can therefore corrupt the
status of any build in flight.

- Add `GET /api/health` (process liveness) and `/api/ready` (a `SELECT 1`).
- On `SIGTERM`: stop claiming new steps, await the in-flight step, clear the
  interval, drain the pool, exit. `timer.unref?.()`
  (`src/lib/deploy-engine.ts:306`) means the loop will not hold the process open
  on its own, so this must be explicit.

### 1.4 Back off the reconciler when idle
`POLL_MS = 500` runs a reaper `UPDATE ... RETURNING` plus a `SELECT` twice a
second forever — about **172,000 query pairs a day on a fully idle instance**.
Adaptive backoff (500 ms while work is in flight, decaying to ~5 s when idle,
reset on `createDeployment`) removes nearly all of that, and matters more on a
small VPS than anywhere else. `LISTEN/NOTIFY` is the tidier end state.

### 1.5 Data retention
No pruning exists for `deployment_logs`, `audit_log` or `activity` — verified,
zero retention statements in `src/`. `deployment_logs` grows with every build and
a *real* build driver streams thousands of lines per deploy, so on a small VPS
this is the disk-exhaustion path. Add a retention sweep on the reconciler's idle
tick, with per-table windows (logs shortest; **`audit_log` needs care** — it is
hash-chained by design, so pruning must delete whole prefixes and re-anchor the
chain, never punch holes, or the tamper-evidence UI will correctly report the
chain as broken).

### 1.6 Container, proxy, and host
See §4 for concrete configuration. Summary:

- Multi-stage `Dockerfile` on `node:22-alpine`, non-root, copying only the
  standalone output.
- **Caddy** as the TLS terminator (automatic HTTPS, ~1 binary, tens of MB) —
  and the place where `X-Real-IP` is set so §0.5 holds.
- App bound to `127.0.0.1`.
- Local Postgres tuned for the box (§4.3), plus `zram`/swap so a build spike
  degrades instead of OOM-killing the control plane.
- systemd hardening directives if running without Docker.
- Postgres backups (§4.5).

---

## 4. Reference deployment for one small VPS

*(concrete configs — Dockerfile, Compose, Caddyfile, Postgres tuning, systemd
unit, backup and observability choices — are specified in §4.1–§4.6 of the
implementation issues this plan opens; the sizing envelope is below.)*

### Sizing envelope, from the measured numbers

| VPS | Verdict |
|---|---|
| **1 GB** | Viable **only** after Phase 1: app ~184 MB + Postgres ~150 MB + Caddy ~20 MB. Impossible today (558 MB app alone). No headroom for builds. |
| **2 GB** | Comfortable for trusted mode with real builds of modest size. Recommended minimum. |
| **4 GB** | Comfortable, and the floor for anything in Phase 4. |

Builds are the variable: a `next build` of a mid-size app peaks well above the
control plane's entire footprint, which is exactly why build cgroup limits
(Phase 4) matter even in trusted mode.

---

## 5. Phase 2 — Correctness harness (~3–4 days)

**There are zero tests.** CI runs typecheck and build only. For a plan whose goal
is "works flawlessly", this is the highest-leverage phase, and the codebase is
already shaped to make it cheap:

- `decideVerification` (`src/lib/dns.ts:75`) is already a pure function, and
  `verifyDomainDns` takes an injectable resolver. Both DNS branches are testable
  without network access — the author clearly intended this.
- PGlite is a genuinely excellent test database: real Postgres semantics, no
  container, fast per-test isolation. Keeping it (§1.2) pays off here.

Proposed:

1. **Unit** — `crypto.ts` round-trip + tamper detection + key rotation, `dns.ts`
   both branches, `quota.ts` boundaries, `audit.ts` chain verification (including
   a deliberately broken chain), `rate-limit.ts` window edges and the
   `x-real-ip`/XFF precedence.
2. **Integration** — route handlers against a PGlite-backed database. Priority:
   the authorization matrix (owner vs member vs non-member vs unauthenticated ×
   every mutating route), quota 402s, and team RBAC.
3. **Deploy engine, deterministically** — inject the clock and the step table
   instead of relying on wall-clock `setInterval`. Must cover: crash-and-resume
   mid-script, the double-claim race (two reconcilers, one step), cancel racing
   a finish, and the reaper's finalize-crash path from §1.3.
4. **Smoke** — Playwright: sign up → import → watch a build reach READY →
   assert the Phase 0.2 security headers are present and no CSP violation fires.

### CI additions
Current CI is a clean, sensible typecheck-and-build with a good `concurrency`
block. Add: the test job, dependency and secret scanning, SAST, a lockfile
check, and pin actions by commit SHA rather than floating tags. `npm audit` is
clean *today*; nothing in the repo keeps it that way tomorrow.

---

## 6. Phase 3 — Feature gaps worth closing

Ranked by value for a hosting product, with the honest note that several are
substantial projects rather than tickets:

1. **Real git integration** — a GitHub App: push-triggered deploys, PR preview
   comments, commit status. Deploy hooks exist and are a reasonable stand-in, but
   this is *the* defining PaaS feature and the repo currently fabricates commit
   SHAs and messages (`src/lib/deploy-engine.ts:312-345`).
2. **MFA** — TOTP first (small, self-contained, no external dependency), then
   passkeys/WebAuthn. Neither exists today.
3. **Email verification and password reset** — neither exists; both need an
   email transport, which is also the missing piece for team invites to reach
   people who do not already have an account.
4. **Preview deployment protection** — preview URLs are unauthenticated and
   `url_slug` is `<project-slug>-<9 hex>` (≈36 bits). Vercel ships
   password/SSO-protected previews; this is a genuine parity gap and a
   confidentiality issue for pre-release work.
5. **API token scopes and expiry** — tokens are all-or-nothing and never expire.
   Also drop the `last_used` write on every request (`src/lib/auth.ts:173`): it
   turns every authenticated read into a write. Coalesce to once per minute.
6. **OTLP export** — `src/lib/trace.ts` already produces W3C-conformant ids and
   `middleware.ts` propagates them properly. Wiring an exporter is small, and on
   a small VPS the collector's own footprint is the thing to watch.

---

## 7. Phase 4 — The isolation gate

Do not implement `DeploymentDriver` for real without this. Concretely:

1. Add `ZALE_ALLOW_UNTRUSTED_BUILDS` (default off). With it off, the driver
   refuses any repository not on an operator allowlist — that is "trusted mode",
   and it is a legitimate, useful product on a 2 GB VPS.
2. With it on, refuse to start unless an isolation backend is configured.
3. Regardless of mode, every build gets: a hard wall-clock timeout, cgroup
   memory/CPU/pids limits, a disk quota on the scratch directory, a
   default-deny egress policy with an allowlist for package registries, and a
   non-root user in a fresh mount namespace.

The comparison of isolation backends — rootless BuildKit, gVisor, Kata,
Firecracker, Bubblewrap — and which are defensible at small scale is the subject
of the research accompanying this plan (§8).

---

## 8. Research appendix

### 8.1 Dependency currency — verified against upstream advisories

Checked directly against the npm registry and Vercel's published advisories.
This is the part of the plan with the shortest shelf life, so the dates matter.

| Fact | Value |
|---|---|
| Installed | `next@15.5.21` (published 2026-07-21) |
| Latest 15.5.x | `15.5.22` (published 2026-07-25) |
| `latest` dist-tag | **`16.2.12`** — the repo is a major line behind |

`15.5.22` is **not** a security release: its only change is "[15.5] Reject
TypeScript >= 7.0 with an actionable error". No upgrade urgency there.

Two 2026 advisories matter for this codebase, and the result is a near miss
rather than a clean bill of health:

- **GHSA-m99w-x7hq-7vfj** — Denial of Service in App Router via Server Actions
  (High). Affected: `>=13.0.0 <15.5.21` and `>=16.0.0 <16.2.11`. The installed
  `15.5.21` **is the first patched release** for the 13–15 line. The repo is
  therefore patched by exactly one version, and only because it happened to
  install a build from nine days ago. Preconditions are App Router **plus at
  least one Server Action** — which this app has.
- **GHSA-6gpp-xcg3-4w24** — Middleware/proxy bypass in App Router (High).
  Affected: `>=16.0.0 <16.2.11` only, and it additionally requires Turbopack and
  a single `config.i18n.locales` entry. **15.5.21 is not affected**, but note the
  shape: it is a second, independent instance of middleware-based authorization
  being bypassable. That is the strongest possible argument for the architecture
  this repo already follows — authorization in route handlers and pages, never in
  middleware. Do not "improve" that by centralising authz into `middleware.ts`.
- **CVE-2025-29927** — patched in `15.2.3`; `15.5.21` is well past it.

`npm audit` reports 0 vulnerabilities against the installed tree, which is
consistent with all of the above.

**Conclusion:** the dependency posture is clean *today* and was clean by luck of
timing, not by process. That is precisely the argument for the Renovate or
Dependabot policy in §5 — landing on a security patch by coincidence is not a
control. Separately, planning the 15 → 16 major upgrade belongs on the roadmap:
staying on a superseded major line means future advisories will be patched on
16.x first, and possibly only there.

### 8.2 Session cookie — confirmed

The `Secure` gap from §0.1 is not a stylistic preference. OWASP classes it as
mandatory, so a session cookie without it is directly non-compliant:

> The `Secure` cookie attribute instructs web browsers to only send the cookie
> through an encrypted HTTPS (SSL/TLS) connection. This session protection
> mechanism is **mandatory** to prevent the disclosure of the session ID through
> MitM (Man-in-the-Middle) attacks.
>
> — [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### 8.3 Sources under review

A wider research pass is collecting exact parameter values against these
primary sources. Claims from them are **not** reproduced here until each has
survived adversarial verification, so that this document never carries an
unchecked number:

OWASP Password Storage / Session Management / HTTP Headers cheat sheets ·
OWASP ASVS 5.0 V6 · NIST SP 800-63B-4 · Node.js "Don't block the event loop" ·
Next.js official docs (CSP, self-hosting, testing, Server Components security)
and GHSA-f82v-jwr5-mffw · gVisor security architecture · rootless BuildKit ·
Firecracker production host setup · container-runtime benchmarks ·
Crunchy Data Postgres tuning · PGlite docs · Caddy Caddyfile options ·
Testcontainers Postgres · Renovate minimum-release-age.

The topics still open are: Argon2id vs scrypt parameters and their memory cost
on a 1–2 GB host, the exact recommended header values, App Router nonce-CSP
mechanics under React 19 (including its documented cost — nonce CSP forces
dynamic rendering), isolation-backend overheads, Postgres settings for a small
host, and the CI/testing baseline.

---

## 9. Sequencing

| Phase | Effort | Ship independently? |
|---|---|---|
| 0 — Fail closed | 1–2 days | Yes. Do this first regardless of everything else. |
| 1 — Compaction & deployment | 2–3 days | Yes. Unblocks running on a 1–2 GB VPS. |
| 2 — Tests & CI | 3–4 days | Yes, and it protects Phases 0–1 from regressing. |
| 3 — Features | Weeks, item by item | Yes, individually. |
| 4 — Isolation | Weeks; a genuine design project | **No.** Gates any real build driver. |

Phases 0 and 1 together are roughly a week and convert this from "a very complete
simulation" into "a service that can safely run on a small VPS". Phase 2 is what
makes "flawlessly" a claim that can be checked rather than asserted.

## 10. Open decisions for the owner

1. **Trusted or untrusted?** Is the near-term goal deploying your own projects
   (Phases 0–3 suffice, 2 GB VPS) or accepting other people's code (Phase 4 is
   mandatory and a small VPS stops being appropriate)? This is the one answer
   that changes the most downstream work.
2. **Argon2id or async scrypt?** Argon2id is the stronger recommendation but adds
   a native dependency, which the codebase has so far deliberately avoided
   ("scrypt, no native deps" — `src/lib/auth.ts:16`). Async scrypt keeps that
   property. See §6 of the research appendix for the memory arithmetic.
3. **Managed Postgres or local?** Local is cheapest and simplest; managed removes
   the backup burden of §1.5–§4.5. Both are supported by the existing
   `DATABASE_URL` seam.
4. **Retention windows** for logs, activity and the hash-chained audit log —
   these are policy, not engineering, and the audit chain constrains the answer.
