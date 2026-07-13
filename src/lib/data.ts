import { db } from "./db";
import { id, randomHex, slugify } from "./utils";

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
  created_at: number;
};

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
  created_at: number;
};

// ---------- projects ----------

export function listProjects(userId: string): Project[] {
  return db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Project[];
}

export function getProject(userId: string, projectId: string): Project | undefined {
  return db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId) as Project | undefined;
}

export function createProject(
  userId: string,
  input: {
    name: string;
    repo_url: string;
    framework: string;
    root_dir?: string;
    build_command?: string | null;
    output_dir?: string | null;
    install_command?: string | null;
  }
): Project {
  let slug = slugify(input.name);
  const taken = db
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
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO projects (id, user_id, name, slug, repo_url, framework, root_dir, build_command, output_dir, install_command, node_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    project.created_at
  );
  return project;
}

export function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<Pick<Project, "name" | "framework" | "root_dir" | "build_command" | "output_dir" | "install_command" | "node_version">>
): Project | undefined {
  const project = getProject(userId, projectId);
  if (!project) return undefined;
  const next = { ...project, ...patch };
  db.prepare(
    `UPDATE projects SET name = ?, framework = ?, root_dir = ?, build_command = ?, output_dir = ?, install_command = ?, node_version = ? WHERE id = ?`
  ).run(
    next.name,
    next.framework,
    next.root_dir,
    next.build_command,
    next.output_dir,
    next.install_command,
    next.node_version,
    projectId
  );
  return next;
}

export function deleteProject(userId: string, projectId: string): boolean {
  const res = db
    .prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
    .run(projectId, userId);
  return res.changes > 0;
}

// ---------- deployments ----------

export function listDeployments(projectId: string, limit = 50): Deployment[] {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(projectId, limit) as Deployment[];
}

export function latestDeployment(projectId: string): Deployment | undefined {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId) as Deployment | undefined;
}

export function currentProductionDeployment(projectId: string): Deployment | undefined {
  return db
    .prepare("SELECT * FROM deployments WHERE project_id = ? AND is_current = 1 LIMIT 1")
    .get(projectId) as Deployment | undefined;
}

export function getDeployment(deploymentId: string): Deployment | undefined {
  return db
    .prepare("SELECT * FROM deployments WHERE id = ?")
    .get(deploymentId) as Deployment | undefined;
}

export function getDeploymentBySlug(urlSlug: string): Deployment | undefined {
  return db
    .prepare("SELECT * FROM deployments WHERE url_slug = ?")
    .get(urlSlug) as Deployment | undefined;
}

/** Verifies the deployment belongs to a project owned by the user. */
export function getDeploymentForUser(
  userId: string,
  deploymentId: string
): (Deployment & { project_name: string; project_slug: string }) | undefined {
  return db
    .prepare(
      `SELECT d.*, p.name AS project_name, p.slug AS project_slug
       FROM deployments d JOIN projects p ON p.id = d.project_id
       WHERE d.id = ? AND p.user_id = ?`
    )
    .get(deploymentId, userId) as
    | (Deployment & { project_name: string; project_slug: string })
    | undefined;
}

export function getLogs(deploymentId: string, afterId = 0): LogLine[] {
  return db
    .prepare(
      "SELECT * FROM deployment_logs WHERE deployment_id = ? AND id > ? ORDER BY id ASC"
    )
    .all(deploymentId, afterId) as LogLine[];
}

// ---------- env vars ----------

export function listEnvVars(projectId: string): EnvVar[] {
  return db
    .prepare("SELECT * FROM env_vars WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as EnvVar[];
}

export function createEnvVar(projectId: string, key: string, value: string, targets: string[]): EnvVar {
  const row: EnvVar = {
    id: id("env"),
    project_id: projectId,
    key: key.trim(),
    value,
    targets: targets.join(","),
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO env_vars (id, project_id, key, value, targets, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(row.id, row.project_id, row.key, row.value, row.targets, row.created_at);
  return row;
}

export function deleteEnvVar(projectId: string, envId: string): boolean {
  const res = db
    .prepare("DELETE FROM env_vars WHERE id = ? AND project_id = ?")
    .run(envId, projectId);
  return res.changes > 0;
}

// ---------- domains ----------

export function listDomains(projectId: string): Domain[] {
  return db
    .prepare("SELECT * FROM domains WHERE project_id = ? ORDER BY is_primary DESC, created_at ASC")
    .all(projectId) as Domain[];
}

export function addDomain(projectId: string, name: string, opts?: { verified?: boolean; primary?: boolean }): Domain {
  const row: Domain = {
    id: id("dom"),
    project_id: projectId,
    name: name.toLowerCase().trim(),
    verified: opts?.verified ? 1 : 0,
    is_primary: opts?.primary ? 1 : 0,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO domains (id, project_id, name, verified, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(row.id, row.project_id, row.name, row.verified, row.is_primary, row.created_at);
  return row;
}

export function verifyDomain(projectId: string, domainId: string): boolean {
  const res = db
    .prepare("UPDATE domains SET verified = 1 WHERE id = ? AND project_id = ?")
    .run(domainId, projectId);
  return res.changes > 0;
}

export function deleteDomain(projectId: string, domainId: string): boolean {
  const res = db
    .prepare("DELETE FROM domains WHERE id = ? AND project_id = ? AND is_primary = 0")
    .run(domainId, projectId);
  return res.changes > 0;
}

// ---------- dashboard helpers ----------

export type ProjectWithDeployment = Project & { deployment: Deployment | null };

export function listProjectsWithLatestDeployment(userId: string): ProjectWithDeployment[] {
  return listProjects(userId).map((p) => ({
    ...p,
    deployment: latestDeployment(p.id) ?? null,
  }));
}
