# Nimbus — a Vercel-style hosting platform

Nimbus is a self-hostable clone of the Vercel developer experience: import a
git repository, watch the build stream live, and get a production deployment
with preview URLs, custom domains, environment variables and analytics — all
from a dark, keyboard-friendly dashboard.

The platform is fully functional end-to-end. The only simulated part is the
machine layer that would live in a datacenter: builds run through a
`DeploymentDriver` interface (`src/lib/deploy-engine.ts`) whose current
implementation walks the real deployment state machine on a timer and emits
realistic build logs. When real infrastructure exists, implement that one
interface against it and nothing else changes.

## Features

- **Marketing site** — landing page with features, how-it-works and pricing
- **Auth** — email/password accounts (scrypt hashing), 30-day sessions
- **Projects** — import from a git URL with framework presets (Next.js, Vite,
  Astro, SvelteKit, Remix, Nuxt, static), root directory and build overrides
- **Deployments** — queued → building → deploying → ready/error/canceled state
  machine, streaming build logs, cancel, redeploy, automatic promotion of
  successful production builds (occasional simulated failures exercise the
  error path)
- **Preview URLs** — every deployment gets a unique URL; `/preview/<slug>`
  simulates what the edge would serve, including 502-style error pages for
  failed builds
- **Domains** — add custom domains, DNS instructions, verification flow
- **Environment variables** — per-environment (production/preview/development)
  scoping with hidden values and reveal toggle
- **Analytics** — requests, bandwidth and error-rate over 7/30/90 days with
  crosshair tooltips and table views (deterministic sample data per project)
- **Settings** — rename, build configuration, Node version, delete with
  type-to-confirm

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- SQLite via `better-sqlite3` (file lives in `data/`, created on first run) —
  swap for Postgres by reimplementing `src/lib/db.ts` + `src/lib/data.ts`

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
    db.ts              # SQLite schema + connection
    auth.ts            # sessions, password hashing
    data.ts            # typed queries
    deploy-engine.ts   # DeploymentDriver interface + simulated build pipeline
    frameworks.ts      # framework presets
    metrics.ts         # deterministic sample analytics
```
