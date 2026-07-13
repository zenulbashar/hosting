# Infrastructure Plan — from simulator to Sydney datacenter

This document maps the path from the current platform (real UI/API, simulated
machines) to physical infrastructure in Australia, purpose-built for hosting
**websites and always-on AI agents**. It is a planning aid, not a quote —
validate pricing and availability with vendors before committing.

## 1. Strategy

- **Home region: Sydney (`syd1`).** Lowest latency for ANZ customers, data
  residency in Australia (a real selling point for AU businesses adopting AI
  agents), and straightforward access to carrier-neutral facilities.
- **Workload mix.** Two distinct profiles:
  - *Sites*: build jobs (bursty CPU) + static/edge serving (light, cacheable).
  - *AI agents*: always-on worker processes — steady CPU/RAM, long-lived
    connections, outbound calls to LLM APIs. GPU only if self-hosting models.
- **Buy, don't build, the building.** Start with colocation racks in a
  carrier-neutral Sydney facility; a private datacenter only makes sense at
  hundreds of racks.

## 2. Sourcing hardware

### Server OEMs (worldwide)

| Vendor | Notes |
|---|---|
| **Dell Technologies** | Largest global server vendor; PowerEdge line; strong AU presence and enterprise support |
| **HPE** | ProLiant line; comparable coverage and support in AU |
| **Lenovo** | ThinkSystem line; competitive pricing |
| **Supermicro** | Favoured by cloud builders for price/performance and density; common choice for GPU nodes |

### Buying channels in Australia

- **Direct OEM enterprise sales** (Dell/HPE/Lenovo all have Sydney offices) —
  negotiable at volume, bundled support contracts.
- **Wholesale IT distributors**: Dicker Data, Ingram Micro Australia, and
  TD Synnex distribute the major server brands locally; resellers quote from
  them. Good for mixed orders (servers + switches + firewalls).
- **Refurbished/off-lease wholesale** (e.g. ex-hyperscaler gear) — a
  cost-effective way to stand up staging or the first build cluster; keep
  production on warrantied new equipment.

### Starter bill of materials (one rack, indicative shape — get quotes)

| Qty | Role | Shape |
|---|---|---|
| 4 | Agent runtime nodes | 2U, 32–64 cores, 256–512 GB RAM, NVMe |
| 2 | Build cluster nodes | 1U, high-clock CPUs, 128 GB RAM, fast NVMe scratch |
| 2 | Storage nodes | 2U, mixed NVMe + HDD, replicated (object store for build artifacts + logs) |
| 1 | GPU node (optional, phase 2) | NVIDIA L40S/H100-class via OEM config — only if self-hosting models; agents that call external LLM APIs don't need it |
| 2 | Top-of-rack switches | 25/100 GbE, redundant pair |
| 1 | Firewall/router pair | BGP-capable for your own IP space |

### Facility (Sydney colocation)

Carrier-neutral operators with Sydney campuses to evaluate: **NEXTDC**
(S-series), **Equinix** (SY-series), **CDC Data Centres**, **AirTrunk**,
**Global Switch**. Compare on: power price per kW, rack density allowance
(agents run hot at steady state), cross-connect fees, and access to
**IX Australia** peering plus at least two upstream transit providers.

## 3. Mapping the software to the metal

The platform was built so that only the bottom layer changes:

| Platform seam (already built) | Physical implementation |
|---|---|
| `DeploymentDriver` (`src/lib/deploy-engine.ts`) | Dispatch builds to the build cluster (Kubernetes jobs or Firecracker microVMs); stream logs back into `deployment_logs` |
| Agent runtime (`kind: "agent"` presets) | Long-running containers with health checks + auto-restart on the agent nodes; the console at `/preview/<slug>` becomes the real agent status page |
| `region` field on projects | Scheduler picks the target cluster (`syd1` first; new regions are new clusters) |
| Preview URLs / domains | Edge proxy (Caddy/Traefik/OpenResty) + wildcard TLS; put a CDN (e.g. Cloudflare) in front until the global edge exists |
| SQLite (`src/lib/db.ts`, `data.ts`) | Postgres (HA pair) — the two files are the entire swap surface |
| Usage metering (`src/lib/metrics.ts`) | Real ingestion from the edge proxy + runtime (requests, bytes, build minutes already modelled) |
| Billing (`src/lib/billing.ts`) | Stripe (or local eq.) behind the existing `POST /api/billing` endpoint |

## 4. Phases

1. **Now** — this app: sell the experience, onboard design partners, simulated builds.
2. **Cloud bridge** — run the real `DeploymentDriver` on rented Sydney cloud
   instances (AWS ap-southeast-2 / equivalents) to prove the pipeline with zero
   capex.
3. **First rack** — colo in Sydney, migrate the build cluster and agent
   runtime to owned hardware; keep the cloud as burst capacity.
4. **Scale** — second rack / second site (Melbourne `mel1`), GPU nodes if
   self-hosted inference demand shows up, then international PoPs.
