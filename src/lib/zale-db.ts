/**
 * Zale DB — managed Postgres, integrated with Zale Hosting.
 *
 * This is the control plane: it models databases, branches and scoped
 * credentials as durable rows and synthesizes the connection strings a
 * deployment would use. The *data plane* (the bytes on disk in a real Postgres
 * cluster) is the one simulated piece — exactly like the build-machine layer in
 * deploy-engine.ts. The `DatabaseProvisioner` interface is the seam: implement
 * it against a real Postgres control plane (Neon-style branching, or your own)
 * and nothing above this file changes.
 *
 * The integration that matters: every *preview* deployment automatically forks
 * its own branch off the primary, with credentials scoped to that branch alone —
 * so preview traffic can never touch production data. Branches bind to their
 * deployment via a foreign key, so when the deployment is deleted the branch and
 * its credentials cascade away with it. Deleting the project cascades the whole
 * database. Passwords are encrypted at rest with the same envelope encryption
 * used for environment-variable secrets.
 */
import { db } from "./db";
import { getRegion } from "./regions";
import { id, randomHex } from "./utils";
import { encryptSecret, decryptSecret } from "./crypto";
import { recordActivity } from "./activity";

export type Database = {
  id: string;
  project_id: string;
  name: string;
  region: string;
  status: string; // creating | available | deleting
  created_at: number;
};

export type DbBranch = {
  id: string;
  database_id: string;
  name: string;
  kind: "primary" | "preview";
  parent_branch: string | null;
  deployment_id: string | null;
  status: string;
  created_at: number;
};

export type DbCredential = {
  id: string;
  branch_id: string;
  role: "owner" | "readonly";
  username: string;
  password_enc: string;
  created_at: number;
};

/** A branch with its (masked or revealed) connection details for the UI/API. */
export type BranchConnection = {
  branch: DbBranch;
  username: string;
  host: string;
  port: number;
  database: string;
  /** Full DSN with the real password — only returned on explicit reveal. */
  connectionString?: string;
  /** DSN with the password masked — safe to list. */
  maskedConnectionString: string;
};

const PRIMARY_BRANCH = "primary";
const PORT = 5432;

/** The regional endpoint a database is reached on. */
export function dbEndpoint(region: string): string {
  return `${getRegion(region).id}.db.zale.app`;
}

/** Postgres schema a branch maps to on the cluster (search_path target). */
function branchSchema(branch: DbBranch): string {
  return branch.kind === "primary" ? "public" : `br_${branch.id.replace(/[^a-z0-9]/gi, "").slice(-16)}`;
}

function dsn(opts: {
  region: string;
  database: string;
  username: string;
  password: string;
  schema: string;
}): string {
  const search = encodeURIComponent(`-c search_path=${opts.schema}`);
  return `postgres://${opts.username}:${opts.password}@${dbEndpoint(opts.region)}:${PORT}/${opts.database}?sslmode=require&options=${search}`;
}

// ---------- the provisioner seam ----------

export interface DatabaseProvisioner {
  provisionDatabase(projectId: string, name: string, region: string, actor: string): Promise<Database>;
  createPreviewBranch(databaseId: string, deploymentId: string, label: string): Promise<DbBranch | null>;
  dropBranch(branchId: string): Promise<boolean>;
  deleteDatabase(projectId: string, databaseId: string, actor: string): Promise<boolean>;
}

async function newCredential(branchId: string, role: "owner" | "readonly"): Promise<DbCredential> {
  const cred: DbCredential = {
    id: id("cred"),
    branch_id: branchId,
    role,
    username: `zdb_${randomHex(8)}`,
    password_enc: encryptSecret(randomHex(32)),
    created_at: Date.now(),
  };
  await db
    .prepare(
      "INSERT INTO db_credentials (id, branch_id, role, username, password_enc, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(cred.id, cred.branch_id, cred.role, cred.username, cred.password_enc, cred.created_at);
  return cred;
}

/** Default control-plane implementation, backed by the platform's Postgres. */
export const zaleDb: DatabaseProvisioner = {
  async provisionDatabase(projectId, name, region, actor) {
    const database: Database = {
      id: id("db"),
      project_id: projectId,
      name: name.toLowerCase().trim(),
      region: getRegion(region).id,
      status: "available",
      created_at: Date.now(),
    };
    await db
      .prepare("INSERT INTO databases (id, project_id, name, region, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(database.id, database.project_id, database.name, database.region, database.status, database.created_at);

    // Primary branch + its owner credentials.
    const primary: DbBranch = {
      id: id("br"),
      database_id: database.id,
      name: PRIMARY_BRANCH,
      kind: "primary",
      parent_branch: null,
      deployment_id: null,
      status: "available",
      created_at: Date.now(),
    };
    await db
      .prepare(
        "INSERT INTO db_branches (id, database_id, name, kind, parent_branch, deployment_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(primary.id, primary.database_id, primary.name, primary.kind, primary.parent_branch, primary.deployment_id, primary.status, primary.created_at);
    await newCredential(primary.id, "owner");

    await recordActivity(projectId, actor, "database.created", `Zale DB "${database.name}" provisioned in ${database.region}`);
    return database;
  },

  async createPreviewBranch(databaseId, deploymentId, label) {
    const database = await db.prepare("SELECT * FROM databases WHERE id = ?").get<Database>(databaseId);
    if (!database) return null;
    // Idempotent: one branch per deployment.
    const existing = await db
      .prepare("SELECT * FROM db_branches WHERE database_id = ? AND deployment_id = ?")
      .get<DbBranch>(databaseId, deploymentId);
    if (existing) return existing;

    const safeLabel = (label || "preview").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 24);
    const branch: DbBranch = {
      id: id("br"),
      database_id: databaseId,
      name: `preview/${safeLabel}-${randomHex(4)}`,
      kind: "preview",
      parent_branch: PRIMARY_BRANCH,
      deployment_id: deploymentId,
      status: "available",
      created_at: Date.now(),
    };
    await db
      .prepare(
        "INSERT INTO db_branches (id, database_id, name, kind, parent_branch, deployment_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(branch.id, branch.database_id, branch.name, branch.kind, branch.parent_branch, branch.deployment_id, branch.status, branch.created_at);
    await newCredential(branch.id, "owner");
    await recordActivity(database.project_id, "system", "database.branch.created", `Preview branch ${branch.name} forked from ${PRIMARY_BRANCH}`);
    return branch;
  },

  async dropBranch(branchId) {
    const branch = await db.prepare("SELECT * FROM db_branches WHERE id = ?").get<DbBranch>(branchId);
    if (!branch || branch.kind === "primary") return false; // never drop primary
    const res = await db.prepare("DELETE FROM db_branches WHERE id = ?").run(branchId);
    return res.changes > 0;
  },

  async deleteDatabase(projectId, databaseId, actor) {
    const database = await db
      .prepare("SELECT * FROM databases WHERE id = ? AND project_id = ?")
      .get<Database>(databaseId, projectId);
    if (!database) return false;
    // Branches + credentials cascade via FK.
    const res = await db.prepare("DELETE FROM databases WHERE id = ? AND project_id = ?").run(databaseId, projectId);
    if (res.changes > 0) {
      await recordActivity(projectId, actor, "database.deleted", `Zale DB "${database.name}" deleted`);
    }
    return res.changes > 0;
  },
};

// ---------- read helpers ----------

export function listDatabases(projectId: string): Promise<Database[]> {
  return db
    .prepare("SELECT * FROM databases WHERE project_id = ? ORDER BY created_at ASC")
    .all<Database>(projectId);
}

export function getDatabase(projectId: string, databaseId: string): Promise<Database | undefined> {
  return db.prepare("SELECT * FROM databases WHERE id = ? AND project_id = ?").get<Database>(databaseId, projectId);
}

export function listBranches(databaseId: string): Promise<DbBranch[]> {
  return db
    .prepare("SELECT * FROM db_branches WHERE database_id = ? ORDER BY kind DESC, created_at ASC")
    .all<DbBranch>(databaseId);
}

/**
 * Connection details for a branch. Without `reveal`, the password is masked so
 * the value is safe to render in a list; with `reveal`, the full DSN (real
 * password) is returned for a one-time copy.
 */
export async function branchConnection(
  database: Database,
  branch: DbBranch,
  opts?: { reveal?: boolean }
): Promise<BranchConnection | null> {
  const cred = await db
    .prepare("SELECT * FROM db_credentials WHERE branch_id = ? AND role = 'owner' ORDER BY created_at ASC LIMIT 1")
    .get<DbCredential>(branch.id);
  if (!cred) return null;
  const schema = branchSchema(branch);
  const host = dbEndpoint(database.region);
  const password = decryptSecret(cred.password_enc);
  const masked = dsn({ region: database.region, database: database.name, username: cred.username, password: "••••••••", schema });
  const conn: BranchConnection = {
    branch,
    username: cred.username,
    host,
    port: PORT,
    database: database.name,
    maskedConnectionString: masked,
  };
  if (opts?.reveal) {
    conn.connectionString = dsn({ region: database.region, database: database.name, username: cred.username, password, schema });
  }
  return conn;
}
