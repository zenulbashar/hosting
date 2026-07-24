# Zale Hosting — a Vercel-style platform for sites and AI agents

Zale is a self-hostable clone of the Vercel developer experience: import a
git repository, watch the build stream live, and get a production deployment
with preview URLs, custom domains, environment variables and analytics — all
from a dark, keyboard-friendly dashboard with a Forest-green header.

Sydney (`syd1`) is the flagship region, and alongside classic web frameworks
Zale treats **always-on AI agents** (Claude Agent SDK, LangGraph, FastAPI)
as a first-class project type. The path from this app to physical hardware —
including sourcing servers wholesale in Australia — is documented in
[`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md).

The platform is fully functional end-to-end. The only simulated part is the
machine layer that would live in a datacenter: builds run through a
`DeploymentDriver` interface (`src/lib/deploy-engine.ts`) whose current
implementation walks the real deployment state machine and emits realistic
build logs. The engine is **durable** — a deployment's progress (`status`,
`next_step`, `next_run_at`) lives entirely in Postgres, and a reconciler loop
started at server boot (`src/instrumentation.ts`) advances due deployments one
step at a time, claiming each step with an optimistic update so no step ever
runs twice. Because state is persisted, a process restart resumes in-flight
builds instead of stranding them, and a reaper fails anything that can no
longer make progress. When real infrastructure exists, implement that one
interface against it and nothing else changes.

## Features

- **Marketing site** — landing page with features, how-it-works and pricing
- **Auth** — email/password accounts (scrypt hashing), 30-day sessions
- **Projects** — import from a git URL with framework presets (Next.js, Vite,
  Astro, SvelteKit, Remix, Nuxt, static) plus AI-agent presets (Claude Agent
  SDK, LangGraph, FastAPI) that run as always-on workers, region selection
  (Sydney default), root directory and build overrides
- **Deployments** — queued → building → deploying → ready/error/canceled state
  machine, streaming build logs, cancel, redeploy, automatic promotion of
  successful production builds (occasional simulated failures exercise the
  error path). Progress is persisted per step, so a server restart resumes
  in-flight builds instead of stranding them
- **Preview URLs** — every deployment gets a unique URL; `/preview/<slug>`
  simulates what the edge would serve, including 502-style error pages for
  failed builds, and is **region-aware** — it serves from the healthiest region
  holding the deployment and shows which one (with a 503 if every region is down)
- **Multi-region edge** — each site deployment rolls out across every
  operational region (agents run in their home region); a live **Region Status**
  page shows per-region health and can simulate an outage. Deployments **skip**
  a region that's down at rollout time, and live traffic **fails over** to the
  next healthy region automatically. `src/lib/region-health.ts` holds the
  placement/failover logic behind a seam a real health-check feed plugs into
- **Domains** — add custom domains with per-domain DNS instructions and
  **real verification over live DNS**: ownership is confirmed by a
  `_zale-challenge.<domain>` TXT record (`zale-verify=<token>`) or by the
  domain already routing to us (A record = ingress IP, or CNAME = our target)
- **Zale DB** — managed Postgres, one product tab away: provision a database and
  its primary branch instantly, and **every preview deployment automatically
  forks its own isolated branch** with credentials scoped to that branch alone,
  so preview traffic can never touch production data. Passwords are encrypted at
  rest; connection strings reveal on demand. Branches bind to their deployment
  and cascade away with it; deleting the database (or project) cascades the rest.
  A `DatabaseProvisioner` seam is where a real Postgres control plane plugs in
- **Environment variables** — per-environment (production/preview/development)
  scoping with hidden values and reveal toggle
- **Analytics** — requests, bandwidth and error-rate over 7/30/90 days with
  crosshair tooltips and table views (deterministic sample data per project)
- **Settings** — rename, build configuration, Node version, delete with
  type-to-confirm
- **Instant rollback** — promote any READY deployment to production with one
  click, no rebuild
- **Deploy hooks** — per-project URLs that trigger a production deployment on
  any GET/POST (point CI or a git provider webhook at them)
- **API tokens** — personal access tokens (`Authorization: Bearer nbt_…`) that
  authenticate every REST endpoint, for CLI/CI use
- **Account settings** — display name, password change, token management
- **Activity log** — per-project audit trail of deployments, domains, env and
  settings changes
- **Security & audit log** — a **tamper-evident**, account-wide record of
  security-sensitive actions (sign-ins and failures, token create/revoke, plan
  changes, deletions). Each entry is hash-chained to the previous one, so any
  edit, deletion or reordering breaks the chain and is flagged on the page
- **Distributed tracing** — every request is assigned a W3C Trace Context id
  (reusing an inbound `traceparent`), threaded to handlers and echoed as
  `x-trace-id`; audit entries capture it. Point an OTLP collector at it to ship
  spans — the ids already conform to OpenTelemetry
- **Usage & billing** — Hobby/Pro plans with quota meters (bandwidth, requests,
  build minutes, projects, databases), per-project breakdown, invoice history,
  and an upgrade/downgrade flow ready for a real payment provider. **Project,
  database and build-minute limits are enforced** — over-quota creates are
  rejected with a 402 and an upgrade prompt (team-scoped resources are billed to
  the team, not the personal plan)
- **Teams** — shared project scopes with owner/member roles, invite-by-email
  (instant join for existing accounts, auto-join on signup otherwise), a scope
  switcher in the nav, and team-scoped project creation
- **Runtime logs** — live log stream per project: request logs for sites,
  task/heartbeat output for agents, with level filters and pause

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- **Postgres**, one SQL dialect with two drivers behind `src/lib/db.ts`:
  an embedded [PGlite](https://pglite.dev) instance for dev/CI (real Postgres
  compiled to WASM, persisted under `data/pgdata`, no server to run), or a
  real Postgres (Zale DB) in production via `DATABASE_URL`. The data layer is
  fully async, so the web tier is stateless and horizontally scalable.

## Configuration

Environment variables (all optional; sensible defaults for local dev):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | _(embedded PGlite)_ | Postgres connection string (Zale DB). When unset, an embedded PGlite instance under `data/pgdata` is used — great for dev/CI, no server needed. |
| `NEXT_PUBLIC_ZALE_APP_DOMAIN` | `zale.app` | Base domain deployments are served under (`<slug>.<domain>`) |
| `NEXT_PUBLIC_ZALE_INGRESS_IP` | `76.223.87.10` | A-record target shown in custom-domain instructions |
| `ZALE_ENCRYPTION_KEY` | dev fallback | Key for encrypting environment-variable values at rest (AES-256-GCM). **Set this in every real environment** — the dev fallback does not protect secrets. |
| `ZALE_ADMIN_EMAILS` | _(none)_ | Comma-separated operator emails allowed to mutate global infrastructure state (region health on the Status page). Empty means no one can — tenants see region status read-only. |

## Development

```bash
npm install
npm run dev       # http://localhost:3000
```

Sign up with any email/password, then import a project (any git URL works —
the simulator doesn't clone it yet).

```bash
npm run build     # production build
npm start         # serve production build
npm run typecheck
```

## Layout

```
src/
  app/                 # routes (landing, auth, dashboard, project pages, API)
    api/               # REST endpoints: auth, projects, deployments, env, domains
    (app)/             # authenticated dashboard routes
    preview/[slug]/    # simulated "deployed site" for any deployment URL
  components/          # UI primitives + feature components
  lib/
    db.ts              # Postgres schema + driver (PGlite dev / pg prod)
    auth.ts            # sessions, password hashing
    data.ts            # typed queries
    deploy-engine.ts   # DeploymentDriver interface + durable reconciler build pipeline
    zale-db.ts         # Zale DB control plane: databases, branch-per-preview, scoped creds
    dns.ts             # live custom-domain verification (TXT challenge / A / CNAME)
    quota.ts           # plan-limit enforcement (projects, databases, build minutes)
    audit.ts           # tamper-evident, hash-chained security audit log
    trace.ts           # W3C Trace Context (OpenTelemetry-compatible ids)
    region-health.ts   # multi-region rollout, health, placement & failover
  instrumentation.ts   # boot hook: starts the deploy reconciler on server start
  middleware.ts        # assigns/propagates the per-request trace id
    frameworks.ts      # framework presets
    metrics.ts         # deterministic sample analytics
```
