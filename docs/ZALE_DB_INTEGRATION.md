# Zale DB integration & architecture audit

This documents how Zale Hosting integrates with the **real Zale DB** control
plane ([`zenulbashar/DB`](https://github.com/zenulbashar/DB) — a Neon-class
serverless-Postgres platform: Go control plane + pg-gateway + CloudNativePG on
k3s, with branching, scale-to-zero, and envelope secrets), and audits hosting
against the "resource-density" architecture guidance.

## 1. Compatibility model

Zale DB owns the database resource model (org → project → branch → endpoints).
Following that repo's own integration design (`SYSTEM_ARCHITECTURE.md §226`),
hosting is a **consumer**: it stores only *references* and delegates every real
operation to the control-plane REST API.

| Hosting concept | Zale DB concept | How |
|---|---|---|
| A project's database | a Zale DB **project** | `POST /v1/projects {org_id, name, region, pg_version}` |
| Preview-deployment DB | a `preview`-role **branch** (copy-on-write fork) | `POST /v1/projects/{prj}/branches {role: "preview", from_branch, suspend_timeout_s}` |
| Connection string | `GET /v1/projects/{prj}/connection-uri` | masked by default; `reveal=true` returns the full DSN (audited on the Zale DB side) |
| Scale-to-zero | branch suspend/resume | `POST /v1/branches/{br}/suspend` and `/resume` (idempotent; wake-on-connect is transparent at the gateway, ADR-014) |
| Teardown | delete branch / project | `DELETE /v1/branches/{br}`, `DELETE /v1/projects/{prj}` |

What hosting persists locally: `databases.zdb_project_id`,
`databases.zdb_default_branch_id`, `db_branches.zdb_branch_id`. No credentials
are stored for real databases — the control plane assembles the DSN on
`/connection-uri`.

**The `DATABASE_URL` contract.** On provision (and once the project reaches
`ready`), hosting injects the deployed app's env vars exactly as Zale DB's design
specifies: `DATABASE_URL` ← the **pooled** endpoint (`rw_pooled`) and
`DATABASE_URL_DIRECT` ← the **direct** endpoint (`rw_direct`). This is the same
contract Zale DB's own migration runbooks use (web/serverless → pooled, workers
+ CI migrations → direct). Deleting the database removes both.

**Wire compatibility.** The client (`src/lib/zale-db-client.ts`) mirrors Zale
DB's sanctioned `@nimbusdb/api-client` (ADR-012, spec-first from
`api/openapi.yaml`): base URL `…/v1`, `Authorization: Bearer zdb_<64hex>`,
`Idempotency-Key` on writes, RFC 7807 `application/problem+json` errors.

**Soft link, not a cascade.** Hosting only destroys the *ephemeral preview
branches it created*; the primary project is deleted only when the user deletes
the hosting database. There are no cross-system foreign keys.

## 2. Configuration

Set these to provision against a real Zale DB; leave unset for the built-in
simulator (dev/CI/demo — fully functional, no external service).

| Variable | Purpose |
|---|---|
| `ZALE_DB_API_URL` | Control-plane base incl. `/v1`, e.g. `https://api.db.zaleit.com.au/v1` |
| `ZALE_DB_API_KEY` | An org-scoped `zdb_…` service key with `projects:write` + `roles:write` (reveal) |
| `ZALE_DB_ORG_ID` | The `org_…` new projects are created under |

Each database record decides its own mode (real iff it has a `zdb_project_id`),
so switching config never corrupts existing records. The simulated DSN is shaped
like a real endpoint host (`ep-<id>.<region>.db.zaleit.com.au/…?sslmode=require`)
so dev output matches production.

## 3. Implemented vs deferred

Implemented and verified (against a mock control plane implementing
`api/openapi.yaml`): provision, branch-per-preview, connection-uri (masked +
reveal), suspend/resume (incl. deploy-time prewarm of the primary), delete, and
the `DATABASE_URL`/`DATABASE_URL_DIRECT` injection.

Deferred (design-only in the Zale DB repo, marked "Phase 6 / not implemented"):
the `/integrations/nimbus` console flows, `project.nimbus_link`, and HMAC
webhooks (`project.provisioned`, `branch.*`). When those land, hosting subscribes
to the webhooks to refresh state instead of polling on page load.

## 4. Architecture audit (against the density guidance)

The guiding principle — *no CPU/memory/container should exist unless a customer
is actively using it* — maps onto hosting as follows.

| Principle | Hosting status |
|---|---|
| **Control plane vs data plane separated** | Aligned. Hosting is a control plane (API/UI/scheduler); the "machine layer" (build execution) sits behind the `DeploymentDriver` seam and is simulated until real infra exists. |
| **Databases suspend when idle** | Aligned — delegated to Zale DB. Preview branches are created with `suspend_timeout_s` so they scale to zero; hosting prewarms the primary at deploy time. |
| **Hosting containers suspend / wake on request** | Planned, behind `DeploymentDriver`. The wake-on-request pattern is exactly Zale DB's gateway model; generalise it when real workloads exist. |
| **Ephemeral build workers, destroyed after each build** | Planned. Deliberately still simulated — the recommendation is to keep the simulator until demand justifies the real BuildKit-in-ephemeral-container pipeline (git clone depth=1 → detect → build → push OCI → run on k3s → route via suspending gateway). Framework detection (presets) is already reusable. |
| **Preview environments auto-expire** | Partial. Preview DB branches auto-suspend; expiring the preview *deployment* itself is a follow-up. |
| **Lightweight orchestration (k3s, VictoriaMetrics, Loki, R2)** | Infrastructure choice for the real datacenter; recorded in `docs/INFRASTRUCTURE.md`. Not a code concern in this repo. |
| **Persistent state in object storage / metadata DB; compute disposable** | Aligned in spirit — hosting is stateless (Postgres-backed, horizontally scalable per M2); it stores no build artifacts. |

Net: the platform already embodies the two hardest parts — clean control/data-plane
separation and a suspend-capable database tier (via Zale DB) — and the remaining
items are the real build/serve pipeline, which the guidance itself says to defer
behind the existing seam until there is demand.
