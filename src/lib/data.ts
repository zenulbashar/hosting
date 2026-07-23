import { db } from "./db";
import { id, randomHex, slugify } from "./utils";
import { decryptSecret, encryptSecret } from "./crypto";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  repo_url: string;
  framework: string;
  root_dir: string;
  build_command: string | null;
  output_dir: string | null;
  install_command: string | null;
  node_version: string;
  region: string;
  team_id: string | null;
  created_at: number;
};

/**
 * SQL predicate (positional): the project is the user's own or belongs to one
 * of their teams. Uses the userId parameter twice — pass `userId, userId`.
 */
const PROJECT_ACCESS =
  "(p.user_id = ? OR p.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?))";

export type DeploymentStatus = "QUEUED" | "BUILDING" | "DEPLOYING" | "READY" | "ERROR" | "CANCELED";

export type Deployment = {
  id: string;
  project_id: string;
  url_slug: string;
  status: DeploymentStatus;
  environment: "production" | "preview";
  branch: string;
  commit_sha: string;
  commit_msg: string;
  created_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  is_current: 0 | 1;
};

export type LogLine = {
  id: number;
  deployment_id: string;
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
};

export type EnvVar = {
  id: string;
  project_id: string;
  key: string;
  value: string;
  targets: string;
  created_at: number;
};

export type Domain = {
  id: string;
  project_id: string;
  name: string;
  verified: 0 | 1;
  is_primary: 0 | 1;
  verification_token: string;
  created_at: number;
};

// ---------- projects ----------

/** Personal-scope projects (not attached to any team). */
export function listProjects(userId: string): Promise<Project[]> {
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? AND team_id IS NULL ORDER BY created_at DESC")
    .all<Project>(userId);
}

export function listTeamProjects(teamId: string): Promise<Project[]> {
  return db
    .prepare("SELECT * FROM projects WHERE team_id = ? ORDER BY created_at DESC")
    .all<Project>(teamId);
}

/** Any project the user can access: their own or any of their teams'. */
export function getProject(userId: string, projectId: string): Promise<Project | undefined> {
  return db
    .prepare(`SELECT p.* FROM projects p WHERE p.id = ? AND ${PROJECT_ACCESS}`)
    .get<Project>(projectId, userId, userId);
}

export async function createProject(
  userId: string,
  input: {
    name: string;
    repo_url: string;
    framework: string;
    root_dir?: string;
    build_command?: string | null;
    output_dir?: string | null;
    install_command?: string | null;
    region?: string;
    team_id?: string | null;
  }
): Promise<Project> {
  let slug = slugify(input.name);
  const taken = await db
    .prepare("SELECT 1 FROM projects WHERE user_id = ? AND slug = ?")
    .get(userId, slug);
  if (taken) slug = `${slug}-${randomHex(4)}`;

  const project: Project = {
    id: id("prj"),
    user_id: userId,
    name: input.name.trim(),
    slug,
    repo_url: input.repo_url.trim(),
    framework: input.framework,
    root_dir: input.root_dir?.trim() || "./",
    build_command: input.build_command ?? null,
    output_dir: input.output_dir ?? null,
    install_command: input.install_command ?? null,
    node_version: "22.x",
    region: input.region || "syd1",
    team_id: input.team_id ?? null,
    created_at: Date.now(),
  };
  await db
    .prepare(
      `INSERT INTO projects (id, user_id, name, slug, repo_url, framework, root_dir, build_command, output_dir, install_command, node_version, region, team_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      project.id,
      project.user_id,
      project.name,
      project.slug,
      project.repo_url,
      project.framework,
      project.root_dir,
      project.build_command,
      project.output_dir,
      project.install_command,
      project.node_version,
      project.region,
      project.team_id,
      project.created_at
    );
  return project;
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<Pick<Project, "name" | "framework" | "root_dir" | "build_command" | "output_dir" | "install_command" | "node_version" | "region">>
): Promise<Project | undefined> {
  const project = await getProject(userId, projectId);
  if (!project) return undefined;
  const next = { ...project, ...patch };
  await db
    .prepare(
      `UPDATE projects SET name = ?, framework = ?, root_dir = ?, build_command = ?, output_dir = ?, install_command = ?, node_version = ?, region = ? WHERE id = ?`
    )
    .run(
      next.name,
      next.framework,
      next.root_dir,
      next.build_command,
      next.output_dir,
      next.install_command,
      next.node_version,
      next.region,
      projectId
    );
  return next;
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const res = await db
    .prepare(
      `DELETE FROM projects WHERE id = ? AND id IN (
         SELECT p.id FROM projects p WHERE ${PROJECT_ACCESS}
       )`
    )
    .run(projectId, userId, userId);
  return res.changes > 0;
}

// ---------- deployments ----------

export function listDeployments(projectId: string, limit = 50): Promise<Deployment[]> {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all<Deployment>(projectId, limit);
}

export function latestDeployment(projectId: string): Promise<Deployment | undefined> {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get<Deployment>(projectId);
}

export function currentProductionDeployment(projectId: string): Promise<Deployment | undefined> {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? AND is_current = 1 LIMIT 1")
    .get<Deployment>(projectId);
}

export function getDeployment(deploymentId: string): Promise<Deployment | undefined> {
  return db.prepare("SELECT * FROM deployments WHERE id = ?").get<Deployment>(deploymentId);
}

export function getDeploymentBySlug(urlSlug: string): Promise<Deployment | undefined> {
  return db.prepare("SELECT * FROM deployments WHERE url_slug = ?").get<Deployment>(urlSlug);
}

/** Verifies the deployment belongs to a project the user can access. */
export function getDeploymentForUser(
  userId: string,
  deploymentId: string
): Promise<(Deployment & { project_name: string; project_slug: string }) | undefined> {
  return db
    .prepare(
      `SELECT d.*, p.name AS project_name, p.slug AS project_slug
       FROM deployments d JOIN projects p ON p.id = d.project_id
       WHERE d.id = ? AND ${PROJECT_ACCESS}`
    )
    .get<Deployment & { project_name: string; project_slug: string }>(deploymentId, userId, userId);
}

export function getLogs(deploymentId: string, afterId = 0): Promise<LogLine[]> {
  return db
    .prepare("SELECT * FROM deployment_logs WHERE deployment_id = ? AND id > ? ORDER BY id ASC")
    .all<LogLine>(deploymentId, afterId);
}

// ---------- env vars ----------

export function listEnvVars(projectId: string): Promise<EnvVar[]> {
  return db
    .prepare("SELECT * FROM env_vars WHERE project_id = ? ORDER BY created_at DESC")
    .all<EnvVar>(projectId);
}

export async function createEnvVar(
  projectId: string,
  key: string,
  value: string,
  targets: string[]
): Promise<EnvVar> {
  const row: EnvVar = {
    id: id("env"),
    project_id: projectId,
    key: key.trim(),
    value, // plaintext in the returned object (for the immediate API response)
    targets: targets.join(","),
    created_at: Date.now(),
  };
  // Encrypted at rest — the DB never holds the plaintext secret.
  await db
    .prepare("INSERT INTO env_vars (id, project_id, key, value, targets, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.project_id, row.key, encryptSecret(value), row.targets, row.created_at);
  return row;
}

/** Owner-facing listing with values decrypted for the reveal UI. */
export async function listEnvVarsDecrypted(projectId: string): Promise<EnvVar[]> {
  const rows = await listEnvVars(projectId);
  return rows.map((e) => ({ ...e, value: decryptSecret(e.value) }));
}

export async function deleteEnvVar(projectId: string, envId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM env_vars WHERE id = ? AND project_id = ?")
    .run(envId, projectId);
  return res.changes > 0;
}

// ---------- domains ----------

export function listDomains(projectId: string): Promise<Domain[]> {
  return db
    .prepare("SELECT * FROM domains WHERE project_id = ? ORDER BY is_primary DESC, created_at ASC")
    .all<Domain>(projectId);
}

export async function addDomain(
  projectId: string,
  name: string,
  opts?: { verified?: boolean; primary?: boolean }
): Promise<Domain> {
  const row: Domain = {
    id: id("dom"),
    project_id: projectId,
    name: name.toLowerCase().trim(),
    verified: opts?.verified ? 1 : 0,
    is_primary: opts?.primary ? 1 : 0,
    // Per-domain challenge the owner proves control of via a TXT record.
    verification_token: randomHex(32),
    created_at: Date.now(),
  };
  await db
    .prepare(
      "INSERT INTO domains (id, project_id, name, verified, is_primary, verification_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(row.id, row.project_id, row.name, row.verified, row.is_primary, row.verification_token, row.created_at);
  return row;
}

export function getDomain(projectId: string, domainId: string): Promise<Domain | undefined> {
  return db
    .prepare("SELECT * FROM domains WHERE id = ? AND project_id = ?")
    .get<Domain>(domainId, projectId);
}

/** Persist a successful verification. The DNS check happens in the route. */
export async function verifyDomain(projectId: string, domainId: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE domains SET verified = 1 WHERE id = ? AND project_id = ?")
    .run(domainId, projectId);
  return res.changes > 0;
}

export async function deleteDomain(projectId: string, domainId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM domains WHERE id = ? AND project_id = ? AND is_primary = 0")
    .run(domainId, projectId);
  return res.changes > 0;
}

// ---------- promote / rollback ----------

/**
 * Make a READY deployment the live production deployment. Promoting an older
 * deployment is an instant rollback — no rebuild happens.
 */
export async function promoteDeployment(
  userId: string,
  deploymentId: string
): Promise<Deployment | undefined> {
  const deployment = await getDeploymentForUser(userId, deploymentId);
  if (!deployment || deployment.status !== "READY") return undefined;
  await db.prepare("UPDATE deployments SET is_current = 0 WHERE project_id = ?").run(deployment.project_id);
  await db
    .prepare("UPDATE deployments SET is_current = 1, environment = 'production' WHERE id = ?")
    .run(deploymentId);
  return { ...deployment, is_current: 1, environment: "production" };
}

// ---------- deploy hooks ----------

export type DeployHook = {
  id: string;
  project_id: string;
  name: string;
  token: string;
  branch: string;
  created_at: number;
};

export function listDeployHooks(projectId: string): Promise<DeployHook[]> {
  return db
    .prepare("SELECT * FROM deploy_hooks WHERE project_id = ? ORDER BY created_at DESC")
    .all<DeployHook>(projectId);
}

export async function createDeployHook(projectId: string, name: string, branch: string): Promise<DeployHook> {
  const row: DeployHook = {
    id: id("hook"),
    project_id: projectId,
    name: name.trim(),
    token: randomHex(40),
    branch: branch.trim() || "main",
    created_at: Date.now(),
  };
  await db
    .prepare("INSERT INTO deploy_hooks (id, project_id, name, token, branch, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.project_id, row.name, row.token, row.branch, row.created_at);
  return row;
}

export async function deleteDeployHook(projectId: string, hookId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM deploy_hooks WHERE id = ? AND project_id = ?")
    .run(hookId, projectId);
  return res.changes > 0;
}

export async function findDeployHookByToken(
  token: string
): Promise<(DeployHook & { project: Project }) | undefined> {
  const hook = await db.prepare("SELECT * FROM deploy_hooks WHERE token = ?").get<DeployHook>(token);
  if (!hook) return undefined;
  const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get<Project>(hook.project_id);
  if (!project) return undefined;
  return { ...hook, project };
}

// ---------- dashboard helpers ----------

export type ProjectWithDeployment = Project & { deployment: Deployment | null };

export type Scope = { type: "personal" } | { type: "team"; teamId: string };

export async function listProjectsWithLatestDeployment(
  userId: string,
  scope: Scope = { type: "personal" }
): Promise<ProjectWithDeployment[]> {
  const projects = scope.type === "team" ? await listTeamProjects(scope.teamId) : await listProjects(userId);
  return Promise.all(
    projects.map(async (p) => ({ ...p, deployment: (await latestDeployment(p.id)) ?? null }))
  );
}
