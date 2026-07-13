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
  /** Request cancellation. Returns false if the deployment already finished. */
  cancel(deploymentId: string): boolean;
}

// ---------- persistence helpers ----------

function log(deploymentId: string, message: string, level: "info" | "warn" | "error" = "info") {
  db.prepare(
    "INSERT INTO deployment_logs (deployment_id, ts, level, message) VALUES (?, ?, ?, ?)"
  ).run(deploymentId, Date.now(), level, message);
}

function setStatus(deploymentId: string, status: string) {
  db.prepare("UPDATE deployments SET status = ? WHERE id = ?").run(status, deploymentId);
}

function finish(deployment: Deployment, status: "READY" | "ERROR" | "CANCELED") {
  const now = Date.now();
  db.prepare(
    "UPDATE deployments SET status = ?, finished_at = ?, duration_ms = ? WHERE id = ?"
  ).run(status, now, now - deployment.created_at, deployment.id);
  if (status === "READY" && deployment.environment === "production") {
    // Promote: this deployment becomes the live production deployment.
    db.prepare("UPDATE deployments SET is_current = 0 WHERE project_id = ?").run(deployment.project_id);
    db.prepare("UPDATE deployments SET is_current = 1 WHERE id = ?").run(deployment.id);
    recordActivity(
      deployment.project_id,
      "system",
      "deployment.promoted",
      `Deployment ${deployment.url_slug} promoted to production`
    );
  } else if (status === "ERROR") {
    recordActivity(
      deployment.project_id,
      "system",
      "deployment.failed",
      `Deployment ${deployment.url_slug} failed to build`
    );
  }
}

function getStatus(deploymentId: string): string | undefined {
  const row = db.prepare("SELECT status FROM deployments WHERE id = ?").get(deploymentId) as
    | { status: string }
    | undefined;
  return row?.status;
}

// ---------- simulated build script ----------

type Step = { delay: number; run: () => void };

function buildScript(deployment: Deployment, project: Project): Step[] {
  const fw = getFramework(project.framework);
  const steps: Step[] = [];
  const region = getRegion(project.region);
  const machine = fw.kind === "agent" ? "4 cores, 8 GB" : "2 cores, 8 GB";
  const pkgCount = 180 + Math.floor(Math.random() * 900);
  const willFail = Math.random() < 0.08; // exercise the error UI occasionally
  const python = fw.installCommand.startsWith("pip");

  const s = (delay: number, run: () => void) => steps.push({ delay, run });

  s(400, () => {
    setStatus(deployment.id, "BUILDING");
    log(deployment.id, `Running build in ${region.label} – ${region.id}`);
    log(deployment.id, `Build machine configuration: ${machine}`);
  });
  s(600, () => {
    log(deployment.id, `Cloning ${project.repo_url} (Branch: ${deployment.branch}, Commit: ${deployment.commit_sha.slice(0, 7)})`);
  });
  s(1400, () => {
    log(deployment.id, `Cloning completed: ${(Math.random() * 2 + 0.3).toFixed(3)}s`);
    log(deployment.id, `Restored build cache from previous deployment`);
  });

  if (fw.installCommand) {
    s(500, () => log(deployment.id, `Running "${project.install_command || fw.installCommand}"`));
    s(2500, () => {
      if (python) {
        log(deployment.id, `Successfully installed ${Math.floor(pkgCount / 10)} packages (python 3.12)`);
      } else {
        log(deployment.id, `added ${pkgCount} packages in ${(Math.random() * 8 + 3).toFixed(1)}s`);
      }
    });
  }

  const buildCmd = project.build_command || fw.buildCommand;
  if (buildCmd) {
    s(500, () => log(deployment.id, `Running "${buildCmd}"`));
    if (fw.id === "nextjs") {
      s(1200, () => log(deployment.id, `   ▲ Next.js 15.4.5`));
      s(800, () => log(deployment.id, `   Creating an optimized production build ...`));
      if (willFail) {
        s(2200, () => {
          log(deployment.id, `Failed to compile.`, "error");
          log(deployment.id, `./src/app/page.tsx`, "error");
          log(deployment.id, `Type error: Property 'data' does not exist on type 'Promise<Response>'.`, "error");
          log(deployment.id, `Error: Command "${buildCmd}" exited with 1`, "error");
        });
      } else {
        s(2600, () => {
          log(deployment.id, ` ✓ Compiled successfully`);
          log(deployment.id, `   Collecting page data ...`);
        });
        s(1200, () => {
          log(deployment.id, ` ✓ Generating static pages (12/12)`);
          log(deployment.id, `   Finalizing page optimization ...`);
        });
        s(700, () => {
          log(deployment.id, `Route (app)                    Size     First Load JS`);
          log(deployment.id, `┌ ○ /                          5.1 kB          92 kB`);
          log(deployment.id, `├ ○ /about                     1.2 kB          88 kB`);
          log(deployment.id, `└ ƒ /api/health                0 B              0 B`);
        });
      }
    } else if (willFail) {
      s(2400, () => {
        log(deployment.id, `[vite:build] Rollup failed to resolve import "@components/Header"`, "error");
        log(deployment.id, `Error: Command "${buildCmd}" exited with 1`, "error");
      });
    } else {
      s(2400, () => {
        log(deployment.id, `✓ ${34 + Math.floor(Math.random() * 200)} modules transformed.`);
        log(deployment.id, `${project.output_dir || fw.outputDir}/index.html   ${(Math.random() * 4 + 0.5).toFixed(2)} kB`);
        log(deployment.id, `✓ built in ${(Math.random() * 6 + 1).toFixed(2)}s`);
      });
    }
  } else {
    s(800, () => log(deployment.id, `No build command configured, deploying static assets`));
  }

  if (willFail && buildCmd) {
    s(300, () => finish({ ...deployment }, "ERROR"));
    return steps;
  }

  s(600, () => {
    setStatus(deployment.id, "DEPLOYING");
    log(deployment.id, `Deploying outputs...`);
  });
  s(1500, () => {
    log(deployment.id, `Uploading build outputs (${(Math.random() * 40 + 2).toFixed(1)} MB)`);
  });
  if (fw.kind === "agent") {
    s(1100, () => {
      log(deployment.id, `Provisioning always-on agent runtime in ${region.id} (${machine})`);
      log(deployment.id, `Starting agent process...`);
    });
    s(1300, () => {
      log(deployment.id, `✓ Agent online — health check passed (200 in ${Math.floor(Math.random() * 80 + 20)}ms)`);
      log(deployment.id, `Build completed. Populating build cache...`);
    });
  } else {
    s(1200, () => {
      log(deployment.id, `Deployed to edge network (${region.id} + 23 regions)`);
      log(deployment.id, `Build completed. Populating build cache...`);
    });
  }
  s(800, () => {
    log(deployment.id, `Assigning custom domains`);
    log(deployment.id, `✓ Deployment ready`);
    finish({ ...deployment }, "READY");
  });

  return steps;
}

// ---------- simulated driver ----------

class SimulatedDriver implements DeploymentDriver {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  start(deployment: Deployment, project: Project): void {
    log(deployment.id, `Deployment created (${deployment.environment})`);
    const steps = buildScript(deployment, project);
    let i = 0;
    const tick = () => {
      this.timers.delete(deployment.id);
      // Stop advancing if the deployment was canceled or removed meanwhile.
      const status = getStatus(deployment.id);
      if (!status || status === "CANCELED" || status === "ERROR" || status === "READY") return;
      const step = steps[i++];
      if (!step) return;
      step.run();
      if (i < steps.length) {
        this.timers.set(deployment.id, setTimeout(tick, steps[i].delay));
      }
    };
    this.timers.set(deployment.id, setTimeout(tick, steps[0]?.delay ?? 0));
  }

  cancel(deploymentId: string): boolean {
    const status = getStatus(deploymentId);
    if (!status || status === "READY" || status === "ERROR" || status === "CANCELED") return false;
    const timer = this.timers.get(deploymentId);
    if (timer) clearTimeout(timer);
    this.timers.delete(deploymentId);
    const deployment = db.prepare("SELECT * FROM deployments WHERE id = ?").get(deploymentId) as Deployment;
    log(deploymentId, "Deployment canceled by user", "warn");
    finish(deployment, "CANCELED");
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

export function createDeployment(
  project: Project,
  opts?: { environment?: "production" | "preview"; branch?: string; commitMsg?: string }
): Deployment {
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
  db.prepare(
    `INSERT INTO deployments (id, project_id, url_slug, status, environment, branch, commit_sha, commit_msg, created_at, is_current)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(
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

export function cancelDeployment(deploymentId: string): boolean {
  return driver.cancel(deploymentId);
}
