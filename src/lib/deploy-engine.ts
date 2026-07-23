/**
 * Deployment engine — durable, DB-driven.
 *
 * A deployment's progress lives entirely in Postgres: `status`, `next_step`
 * (index into the build script) and `next_run_at` (when the next step is due).
 * A reconciler loop — started at server boot (see instrumentation.ts) and
 * runnable by any replica — advances due deployments one step at a time,
 * claiming each step with an optimistic UPDATE so two workers never double-run
 * it. Because state is persisted, a process restart resumes in-flight builds
 * instead of stranding them, and a reaper fails anything that can no longer
 * make progress.
 *
 * `DeploymentDriver` remains the seam to real infrastructure: replace the
 * simulated `buildScript` + reconciler with a dispatch to a real build cluster
 * (streaming logs back into deployment_logs) and nothing above this file
 * changes.
 */
import { db } from "./db";
import { getFramework } from "./frameworks";
import { getRegion } from "./regions";
import { id, randomHex } from "./utils";
import { recordActivity } from "./activity";
import { zaleDb, listDatabases } from "./zale-db";
import type { Deployment, Project } from "./data";

export interface DeploymentDriver {
  start(deployment: Deployment, project: Project): void;
  cancel(deploymentId: string): Promise<boolean>;
}

const POLL_MS = 500;
// A deployment whose worker vanished mid-finish (next_run_at cleared but not
// finalized) is reaped after this; an absolute cap catches anything wedged.
const STALL_MS = 30_000;
const MAX_BUILD_MS = 60 * 60 * 1000;

// ---------- persistence helpers ----------

async function log(deploymentId: string, message: string, level: "info" | "warn" | "error" = "info") {
  await db
    .prepare("INSERT INTO deployment_logs (deployment_id, ts, level, message) VALUES (?, ?, ?, ?)")
    .run(deploymentId, Date.now(), level, message);
}

async function setStatus(deploymentId: string, status: string) {
  await db.prepare("UPDATE deployments SET status = ? WHERE id = ?").run(status, deploymentId);
}

async function finish(deployment: Deployment, status: "READY" | "ERROR" | "CANCELED") {
  const now = Date.now();
  await db
    .prepare(
      "UPDATE deployments SET status = ?, finished_at = ?, duration_ms = ?, next_run_at = NULL WHERE id = ?"
    )
    .run(status, now, now - deployment.created_at, deployment.id);
  if (status === "READY" && deployment.environment === "production") {
    await db.prepare("UPDATE deployments SET is_current = 0 WHERE project_id = ?").run(deployment.project_id);
    await db.prepare("UPDATE deployments SET is_current = 1 WHERE id = ?").run(deployment.id);
    await recordActivity(
      deployment.project_id,
      "system",
      "deployment.promoted",
      `Deployment ${deployment.url_slug} promoted to production`
    );
  } else if (status === "ERROR") {
    await recordActivity(
      deployment.project_id,
      "system",
      "deployment.failed",
      `Deployment ${deployment.url_slug} failed to build`
    );
  }
}

async function getStatus(deploymentId: string): Promise<string | undefined> {
  const row = await db
    .prepare("SELECT status FROM deployments WHERE id = ?")
    .get<{ status: string }>(deploymentId);
  return row?.status;
}

/** Deterministic per-deployment unit value in [0,1) — so a resumed build
 *  regenerates the exact same script structure (same failure branch). */
function seededUnit(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

// ---------- simulated build script ----------

type Step = { delay: number; run: () => Promise<void> };

function buildScript(deployment: Deployment, project: Project): Step[] {
  const fw = getFramework(project.framework);
  const steps: Step[] = [];
  const region = getRegion(project.region);
  const machine = fw.kind === "agent" ? "4 cores, 8 GB" : "2 cores, 8 GB";
  const pkgCount = 180 + Math.floor(Math.random() * 900);
  // Deterministic so a resumed deployment takes the same branch every time.
  const willFail = seededUnit(deployment.id) < 0.08;
  const python = fw.installCommand.startsWith("pip");

  const s = (delay: number, run: () => Promise<void>) => steps.push({ delay, run });

  s(400, async () => {
    await setStatus(deployment.id, "BUILDING");
    await log(deployment.id, `Running build in ${region.label} – ${region.id}`);
    await log(deployment.id, `Build machine configuration: ${machine}`);
  });
  s(600, async () => {
    await log(deployment.id, `Cloning ${project.repo_url} (Branch: ${deployment.branch}, Commit: ${deployment.commit_sha.slice(0, 7)})`);
  });
  s(1400, async () => {
    await log(deployment.id, `Cloning completed: ${(Math.random() * 2 + 0.3).toFixed(3)}s`);
    await log(deployment.id, `Restored build cache from previous deployment`);
  });

  if (fw.installCommand) {
    s(500, async () => { await log(deployment.id, `Running "${project.install_command || fw.installCommand}"`); });
    s(2500, async () => {
      if (python) {
        await log(deployment.id, `Successfully installed ${Math.floor(pkgCount / 10)} packages (python 3.12)`);
      } else {
        await log(deployment.id, `added ${pkgCount} packages in ${(Math.random() * 8 + 3).toFixed(1)}s`);
      }
    });
  }

  const buildCmd = project.build_command || fw.buildCommand;
  if (buildCmd) {
    s(500, async () => { await log(deployment.id, `Running "${buildCmd}"`); });
    if (fw.id === "nextjs") {
      s(1200, async () => { await log(deployment.id, `   ▲ Next.js 15.4.5`); });
      s(800, async () => { await log(deployment.id, `   Creating an optimized production build ...`); });
      if (willFail) {
        s(2200, async () => {
          await log(deployment.id, `Failed to compile.`, "error");
          await log(deployment.id, `./src/app/page.tsx`, "error");
          await log(deployment.id, `Type error: Property 'data' does not exist on type 'Promise<Response>'.`, "error");
          await log(deployment.id, `Error: Command "${buildCmd}" exited with 1`, "error");
        });
      } else {
        s(2600, async () => {
          await log(deployment.id, ` ✓ Compiled successfully`);
          await log(deployment.id, `   Collecting page data ...`);
        });
        s(1200, async () => {
          await log(deployment.id, ` ✓ Generating static pages (12/12)`);
          await log(deployment.id, `   Finalizing page optimization ...`);
        });
        s(700, async () => {
          await log(deployment.id, `Route (app)                    Size     First Load JS`);
          await log(deployment.id, `┌ ○ /                          5.1 kB          92 kB`);
          await log(deployment.id, `├ ○ /about                     1.2 kB          88 kB`);
          await log(deployment.id, `└ ƒ /api/health                0 B              0 B`);
        });
      }
    } else if (willFail) {
      s(2400, async () => {
        await log(deployment.id, `[vite:build] Rollup failed to resolve import "@components/Header"`, "error");
        await log(deployment.id, `Error: Command "${buildCmd}" exited with 1`, "error");
      });
    } else {
      s(2400, async () => {
        await log(deployment.id, `✓ ${34 + Math.floor(Math.random() * 200)} modules transformed.`);
        await log(deployment.id, `${project.output_dir || fw.outputDir}/index.html   ${(Math.random() * 4 + 0.5).toFixed(2)} kB`);
        await log(deployment.id, `✓ built in ${(Math.random() * 6 + 1).toFixed(2)}s`);
      });
    }
  } else {
    s(800, async () => { await log(deployment.id, `No build command configured, deploying static assets`); });
  }

  if (willFail && buildCmd) {
    s(300, async () => { await finish({ ...deployment }, "ERROR"); });
    return steps;
  }

  s(600, async () => {
    await setStatus(deployment.id, "DEPLOYING");
    await log(deployment.id, `Deploying outputs...`);
  });
  s(1500, async () => {
    await log(deployment.id, `Uploading build outputs (${(Math.random() * 40 + 2).toFixed(1)} MB)`);
  });
  if (fw.kind === "agent") {
    s(1100, async () => {
      await log(deployment.id, `Provisioning always-on agent runtime in ${region.id} (${machine})`);
      await log(deployment.id, `Starting agent process...`);
    });
    s(1300, async () => {
      await log(deployment.id, `✓ Agent online — health check passed (200 in ${Math.floor(Math.random() * 80 + 20)}ms)`);
      await log(deployment.id, `Build completed. Populating build cache...`);
    });
  } else {
    s(1200, async () => {
      await log(deployment.id, `Deployed to edge network (${region.id} + 23 regions)`);
      await log(deployment.id, `Build completed. Populating build cache...`);
    });
  }
  s(800, async () => {
    await log(deployment.id, `Assigning custom domains`);
    await log(deployment.id, `✓ Deployment ready`);
    await finish({ ...deployment }, "READY");
  });

  return steps;
}

// ---------- reconciler ----------

type DeploymentRow = Deployment & { next_step: number; next_run_at: number | null };

let reconciling = false;

async function reconcile() {
  if (reconciling) return;
  reconciling = true;
  try {
    const now = Date.now();

    // Reaper: fail deployments that can no longer make progress — a worker that
    // died mid-finalize (next_run_at cleared, not finalized) or anything wedged
    // well past a sane build time. Resuming builds are advanced below before
    // STALL_MS elapses, so this never touches a healthy resume.
    const reaped = await db
      .prepare(
        `UPDATE deployments SET status = 'ERROR', finished_at = ?, duration_ms = ? - created_at, next_run_at = NULL
         WHERE status IN ('QUEUED','BUILDING','DEPLOYING')
           AND ((next_run_at IS NULL AND ? - created_at > ?) OR (? - created_at > ?))
         RETURNING id, url_slug, project_id`
      )
      .all<{ id: string; url_slug: string; project_id: string }>(now, now, now, STALL_MS, now, MAX_BUILD_MS);
    for (const r of reaped) {
      await log(r.id, "Build worker lost — deployment failed", "error");
      await recordActivity(r.project_id, "system", "deployment.failed", `Deployment ${r.url_slug} failed (worker lost)`);
    }

    // Advance every due deployment by one step.
    const due = await db
      .prepare(
        `SELECT * FROM deployments
         WHERE status IN ('QUEUED','BUILDING','DEPLOYING') AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC LIMIT 20`
      )
      .all<DeploymentRow>(now);

    for (const dep of due) {
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get<Project>(dep.project_id);
      if (!project) continue;
      const steps = buildScript(dep, project);
      const i = dep.next_step;
      const step = steps[i];
      if (!step) {
        // Past the end but not finalized — let the reaper handle it.
        await db.prepare("UPDATE deployments SET next_run_at = NULL WHERE id = ?").run(dep.id);
        continue;
      }
      // Claim step i: advance the pointer and schedule the next step atomically.
      // If another worker already claimed it (or status changed), skip.
      const nextDelay = steps[i + 1]?.delay ?? null;
      const claimed = await db
        .prepare(
          `UPDATE deployments SET next_step = ?, next_run_at = ?
           WHERE id = ? AND next_step = ? AND status IN ('QUEUED','BUILDING','DEPLOYING')`
        )
        .run(i + 1, nextDelay != null ? now + nextDelay : null, dep.id, i);
      if (claimed.changes === 0) continue;
      try {
        await step.run();
      } catch {
        await finish({ ...dep }, "ERROR");
      }
    }
  } finally {
    reconciling = false;
  }
}

/** Start the reconciler once per process. Called at boot (instrumentation.ts). */
export function startReconciler(): void {
  const g = globalThis as unknown as { __zaleReconciler?: ReturnType<typeof setInterval> };
  if (g.__zaleReconciler) return;
  const timer = setInterval(() => void reconcile(), POLL_MS);
  timer.unref?.();
  g.__zaleReconciler = timer;
}

// ---------- public API ----------

const COMMIT_MESSAGES = [
  "Update landing page copy",
  "Fix responsive layout on pricing page",
  "Add OpenGraph tags",
  "Bump dependencies",
  "Refactor header component",
  "Improve Core Web Vitals",
  "Add dark mode toggle",
  "Fix typo in footer",
  "Optimize hero image",
  "Add customer testimonials section",
];

export async function createDeployment(
  project: Project,
  opts?: { environment?: "production" | "preview"; branch?: string; commitMsg?: string }
): Promise<Deployment> {
  const environment = opts?.environment ?? "production";
  const branch = opts?.branch ?? (environment === "production" ? "main" : "feature/update");
  const deployment: Deployment = {
    id: id("dpl"),
    project_id: project.id,
    url_slug: `${project.slug}-${randomHex(9)}`,
    status: "QUEUED",
    environment,
    branch,
    commit_sha: randomHex(40),
    commit_msg:
      opts?.commitMsg ?? COMMIT_MESSAGES[Math.floor(Math.random() * COMMIT_MESSAGES.length)],
    created_at: Date.now(),
    finished_at: null,
    duration_ms: null,
    is_current: 0,
  };
  const firstDelay = buildScript(deployment, project)[0]?.delay ?? 0;
  await db
    .prepare(
      `INSERT INTO deployments (id, project_id, url_slug, status, environment, branch, commit_sha, commit_msg, created_at, is_current, next_step, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
    )
    .run(
      deployment.id,
      deployment.project_id,
      deployment.url_slug,
      deployment.status,
      deployment.environment,
      deployment.branch,
      deployment.commit_sha,
      deployment.commit_msg,
      deployment.created_at,
      deployment.created_at + firstDelay
    );
  await log(deployment.id, `Deployment created (${deployment.environment})`);

  // Zale DB integration: a preview deployment automatically forks its own
  // database branch with credentials scoped to that branch alone, so preview
  // traffic can never touch production data. Best-effort — a provisioning
  // hiccup must never block the deploy, and the branch cascades away with the
  // deployment when it's deleted.
  if (deployment.environment === "preview") {
    try {
      const [database] = await listDatabases(project.id);
      if (database) {
        const branch = await zaleDb.createPreviewBranch(database.id, deployment.id, deployment.branch);
        if (branch) {
          await log(deployment.id, `Provisioned Zale DB preview branch ${branch.name} (credentials scoped to this branch)`);
        }
      }
    } catch {
      await log(deployment.id, "Zale DB preview branch provisioning skipped", "warn");
    }
  }

  // In case the boot hook hasn't run (e.g. a route imported us first), ensure
  // the reconciler is ticking so this deployment progresses.
  startReconciler();
  return deployment;
}

export async function cancelDeployment(deploymentId: string): Promise<boolean> {
  const status = await getStatus(deploymentId);
  if (!status || status === "READY" || status === "ERROR" || status === "CANCELED") return false;
  const dep = await db.prepare("SELECT * FROM deployments WHERE id = ?").get<Deployment>(deploymentId);
  if (!dep) return false;
  await log(deploymentId, "Deployment canceled by user", "warn");
  await finish(dep, "CANCELED");
  return true;
}
