/**
 * Deployment engine.
 *
 * `DeploymentDriver` is the seam between the platform UI/API and the machines
 * that actually build and serve sites. Today the only implementation is
 * `SimulatedDriver`, which walks a deployment through the real state machine
 * (QUEUED → BUILDING → DEPLOYING → READY | ERROR) on a timer and emits
 * realistic build logs. When real datacenter infrastructure exists, implement
 * this interface against it (e.g. dispatch to a build cluster over a queue,
 * stream logs back) and nothing above this file needs to change.
 *
 * Note: the in-process timers make this driver single-instance and non-durable
 * (a restart strands in-flight builds). That is the subject of a later
 * milestone (a persisted state machine); the interface here is designed so
 * that change is contained to this file.
 */
import { db } from "./db";
import { getFramework } from "./frameworks";
import { getRegion } from "./regions";
import { id, randomHex } from "./utils";
import { recordActivity } from "./activity";
import type { Deployment, Project } from "./data";

export interface DeploymentDriver {
  /** Start (or enqueue) a deployment. Must be non-blocking. */
  start(deployment: Deployment, project: Project): void;
  /** Request cancellation. Resolves false if the deployment already finished. */
  cancel(deploymentId: string): Promise<boolean>;
}

// ---------- persistence helpers (async) ----------

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
    .prepare("UPDATE deployments SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?")
    .run(status, now, now - deployment.created_at, deployment.id);
  if (status === "READY" && deployment.environment === "production") {
    // Promote: this deployment becomes the live production deployment.
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

// ---------- simulated build script ----------

type Step = { delay: number; run: () => Promise<void> };

function buildScript(deployment: Deployment, project: Project): Step[] {
  const fw = getFramework(project.framework);
  const steps: Step[] = [];
  const region = getRegion(project.region);
  const machine = fw.kind === "agent" ? "4 cores, 8 GB" : "2 cores, 8 GB";
  const pkgCount = 180 + Math.floor(Math.random() * 900);
  const willFail = Math.random() < 0.08; // exercise the error UI occasionally
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

// ---------- simulated driver ----------

class SimulatedDriver implements DeploymentDriver {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  start(deployment: Deployment, project: Project): void {
    void log(deployment.id, `Deployment created (${deployment.environment})`);
    const steps = buildScript(deployment, project);
    let i = 0;
    const tick = async () => {
      this.timers.delete(deployment.id);
      // Stop advancing if the deployment was canceled or finished meanwhile.
      const status = await getStatus(deployment.id);
      if (!status || status === "CANCELED" || status === "ERROR" || status === "READY") return;
      const step = steps[i++];
      if (!step) return;
      await step.run();
      if (i < steps.length) {
        this.timers.set(deployment.id, setTimeout(tick, steps[i].delay));
      }
    };
    this.timers.set(deployment.id, setTimeout(tick, steps[0]?.delay ?? 0));
  }

  async cancel(deploymentId: string): Promise<boolean> {
    const status = await getStatus(deploymentId);
    if (!status || status === "READY" || status === "ERROR" || status === "CANCELED") return false;
    const timer = this.timers.get(deploymentId);
    if (timer) clearTimeout(timer);
    this.timers.delete(deploymentId);
    const deployment = await db
      .prepare("SELECT * FROM deployments WHERE id = ?")
      .get<Deployment>(deploymentId);
    if (!deployment) return false;
    await log(deploymentId, "Deployment canceled by user", "warn");
    await finish(deployment, "CANCELED");
    return true;
  }
}

// Survive dev-mode HMR: keep one driver instance per process.
const globalForEngine = globalThis as unknown as { __deployDriver?: DeploymentDriver };
export const driver: DeploymentDriver = globalForEngine.__deployDriver ?? new SimulatedDriver();
globalForEngine.__deployDriver = driver;

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
  await db
    .prepare(
      `INSERT INTO deployments (id, project_id, url_slug, status, environment, branch, commit_sha, commit_msg, created_at, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
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
      deployment.created_at
    );
  driver.start(deployment, project);
  return deployment;
}

export function cancelDeployment(deploymentId: string): Promise<boolean> {
  return driver.cancel(deploymentId);
}
