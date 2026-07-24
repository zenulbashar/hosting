/**
 * Zale DB integration — managed Postgres for Zale Hosting projects.
 *
 * Two modes behind one interface, chosen per record:
 *
 *  - REAL: when ZALE_DB_API_URL/KEY/ORG are configured, hosting provisions
 *    against the real Zale DB control plane (github.com/zenulbashar/DB) over its
 *    REST API. Following that repo's design (SYSTEM_ARCHITECTURE §226), a hosting
 *    database stores only references — {zdb_project_id, zdb_default_branch_id} —
 *    and per-branch {zdb_branch_id}; the connection string comes from
 *    `GET /projects/{prj}/connection-uri`, branch-per-preview maps to a
 *    `preview`-role branch (a copy-on-write data fork), and scale-to-zero uses
 *    suspend/resume. The link is soft: no cross-system cascade beyond the
 *    ephemeral preview branches hosting itself created.
 *
 *  - SIMULATED: with no control plane configured, an in-process model (local
 *    tables + envelope-encrypted credentials + a synthesized DSN) keeps the
 *    platform fully runnable for dev/CI/demo. The synthesized DSN mirrors the
 *    real endpoint-host format so dev output matches production.
 *
 * A record is "real" iff it carries a zdb_project_id, so a database created in
 * one mode keeps behaving consistently even if config later changes.
 */
import { db } from "./db";
import { getRegion } from "./regions";
import { id, randomHex } from "./utils";
import { encryptSecret, decryptSecret } from "./crypto";
import { recordActivity } from "./activity";
import { upsertEnvVar, deleteEnvVarByKey } from "./data";
import { ZALE_DB_API_URL, ZALE_DB_API_KEY, ZALE_DB_ORG_ID, zaleDbConfigured } from "./config";
import { createZaleDbClient, type ZaleDbClient } from "./zale-db-client";

export type Database = {
  id: string;
  project_id: string;
  name: string;
  region: string;
  status: string; // provisioning | available/ready | deleting | error
  zdb_project_id: string | null;
  zdb_default_branch_id: string | null;
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
  zdb_branch_id: string | null;
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
// Preview branches scale to zero after this idle window (Zale DB suspend_timeout_s).
const PREVIEW_SUSPEND_TIMEOUT_S = 300;

const isRemote = (d: Database): boolean => Boolean(d.zdb_project_id);

function client(): ZaleDbClient {
  return createZaleDbClient({ baseUrl: ZALE_DB_API_URL, apiKey: ZALE_DB_API_KEY });
}

// ---------- DSN helpers (simulated mode) ----------

/** Synthesized endpoint host, shaped like a real Zale DB endpoint
 *  (`ep-<id>.<region>.db.zaleit.com.au`) so dev DSNs match production. */
function endpointHost(branch: DbBranch, region: string): string {
  const ep = `ep-${branch.id.replace(/[^a-z0-9]/gi, "").slice(-12).toLowerCase()}`;
  return `${ep}.${getRegion(region).id}.db.zaleit.com.au`;
}

function simDsn(opts: { host: string; database: string; username: string; password: string }): string {
  return `postgresql://${opts.username}:${opts.password}@${opts.host}/${opts.database}?sslmode=require`;
}

/** Mask the password in any `postgresql://user:pass@host/…` DSN. */
function maskDsn(uri: string): string {
  return uri.replace(/(postgres(?:ql)?:\/\/[^:@/]+:)[^@]*(@)/, "$1••••••••$2");
}

// ---------- the provisioner seam ----------

export interface DatabaseProvisioner {
  provisionDatabase(projectId: string, name: string, region: string, actor: string): Promise<Database>;
  createPreviewBranch(databaseId: string, deploymentId: string, label: string): Promise<DbBranch | null>;
  dropBranch(branchId: string): Promise<boolean>;
  deleteDatabase(projectId: string, databaseId: string, actor: string): Promise<boolean>;
  /** Scale-to-zero controls (no-ops in simulated mode). */
  suspendBranch(branchId: string): Promise<void>;
  resumeBranch(branchId: string): Promise<void>;
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

async function insertDatabase(row: Database): Promise<void> {
  await db
    .prepare(
      "INSERT INTO databases (id, project_id, name, region, status, zdb_project_id, zdb_default_branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(row.id, row.project_id, row.name, row.region, row.status, row.zdb_project_id, row.zdb_default_branch_id, row.created_at);
}

async function insertBranch(row: DbBranch): Promise<void> {
  await db
    .prepare(
      "INSERT INTO db_branches (id, database_id, name, kind, parent_branch, deployment_id, status, zdb_branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(row.id, row.database_id, row.name, row.kind, row.parent_branch, row.deployment_id, row.status, row.zdb_branch_id, row.created_at);
}

export const zaleDb: DatabaseProvisioner = {
  async provisionDatabase(projectId, name, region, actor) {
    const dbName = name.toLowerCase().trim();
    const now = Date.now();

    if (zaleDbConfigured()) {
      // Real control plane: create the Zale DB project; store only references.
      const created = await client().createProject(
        { org_id: ZALE_DB_ORG_ID, name: dbName, region: getRegion(region).id, pg_version: 17 },
        id("idem")
      );
      const database: Database = {
        id: id("db"),
        project_id: projectId,
        name: dbName,
        region: created.project.region,
        status: created.project.state, // pending → ready (Zale DB reconciler)
        zdb_project_id: created.project.id,
        zdb_default_branch_id: created.project.default_branch_id,
        created_at: now,
      };
      await insertDatabase(database);
      await insertBranch({
        id: id("br"),
        database_id: database.id,
        name: PRIMARY_BRANCH,
        kind: "primary",
        parent_branch: null,
        deployment_id: null,
        status: created.project.state,
        zdb_branch_id: created.project.default_branch_id,
        created_at: now,
      });
      await recordActivity(projectId, actor, "database.created", `Zale DB "${dbName}" provisioned (${created.project.id})`);
      // Inject DATABASE_URL / DATABASE_URL_DIRECT once the project is ready.
      await injectConnectionEnv(database).catch(() => {});
      return database;
    }

    // Simulated mode.
    const database: Database = {
      id: id("db"),
      project_id: projectId,
      name: dbName,
      region: getRegion(region).id,
      status: "available",
      zdb_project_id: null,
      zdb_default_branch_id: null,
      created_at: now,
    };
    await insertDatabase(database);
    const primary: DbBranch = {
      id: id("br"),
      database_id: database.id,
      name: PRIMARY_BRANCH,
      kind: "primary",
      parent_branch: null,
      deployment_id: null,
      status: "available",
      zdb_branch_id: null,
      created_at: now,
    };
    await insertBranch(primary);
    await newCredential(primary.id, "owner");
    await recordActivity(projectId, actor, "database.created", `Zale DB "${dbName}" provisioned in ${database.region}`);
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
    const branchName = `preview/${safeLabel}-${randomHex(4)}`;
    const now = Date.now();

    if (isRemote(database)) {
      const zbr = await client().createBranch(
        database.zdb_project_id!,
        {
          name: `${safeLabel}-${randomHex(4)}`.slice(0, 63),
          from_branch: database.zdb_default_branch_id,
          role: "preview",
          suspend_timeout_s: PREVIEW_SUSPEND_TIMEOUT_S,
        },
        id("idem")
      );
      const branch: DbBranch = {
        id: id("br"),
        database_id: databaseId,
        name: branchName,
        kind: "preview",
        parent_branch: PRIMARY_BRANCH,
        deployment_id: deploymentId,
        status: zbr.state,
        zdb_branch_id: zbr.id,
        created_at: now,
      };
      await insertBranch(branch);
      await recordActivity(database.project_id, "system", "database.branch.created", `Preview branch ${branchName} forked (${zbr.id})`);
      return branch;
    }

    const branch: DbBranch = {
      id: id("br"),
      database_id: databaseId,
      name: branchName,
      kind: "preview",
      parent_branch: PRIMARY_BRANCH,
      deployment_id: deploymentId,
      status: "available",
      zdb_branch_id: null,
      created_at: now,
    };
    await insertBranch(branch);
    await newCredential(branch.id, "owner");
    await recordActivity(database.project_id, "system", "database.branch.created", `Preview branch ${branchName} forked from ${PRIMARY_BRANCH}`);
    return branch;
  },

  async dropBranch(branchId) {
    const branch = await db.prepare("SELECT * FROM db_branches WHERE id = ?").get<DbBranch>(branchId);
    if (!branch || branch.kind === "primary") return false; // never drop primary
    if (branch.zdb_branch_id) {
      // Hosting owns the ephemeral preview branch it created — destroy it remotely.
      await client().deleteBranch(branch.zdb_branch_id).catch(() => {});
    }
    const res = await db.prepare("DELETE FROM db_branches WHERE id = ?").run(branchId);
    return res.changes > 0;
  },

  async deleteDatabase(projectId, databaseId, actor) {
    const database = await db
      .prepare("SELECT * FROM databases WHERE id = ? AND project_id = ?")
      .get<Database>(databaseId, projectId);
    if (!database) return false;
    if (isRemote(database)) {
      await removeConnectionEnv(projectId).catch(() => {});
      await client().deleteProject(database.zdb_project_id!).catch(() => {});
    }
    // Local branches + credentials cascade via FK.
    const res = await db.prepare("DELETE FROM databases WHERE id = ? AND project_id = ?").run(databaseId, projectId);
    if (res.changes > 0) {
      await recordActivity(projectId, actor, "database.deleted", `Zale DB "${database.name}" deleted`);
    }
    return res.changes > 0;
  },

  async suspendBranch(branchId) {
    const branch = await db.prepare("SELECT * FROM db_branches WHERE id = ?").get<DbBranch>(branchId);
    if (branch?.zdb_branch_id) await client().suspendBranch(branch.zdb_branch_id).catch(() => {});
  },

  async resumeBranch(branchId) {
    const branch = await db.prepare("SELECT * FROM db_branches WHERE id = ?").get<DbBranch>(branchId);
    if (branch?.zdb_branch_id) await client().resumeBranch(branch.zdb_branch_id).catch(() => {});
  },
};

// ---------- env-var injection (the DATABASE_URL contract) ----------

/** Fetch a revealed pooled/direct DSN for the database's default branch and write
 *  DATABASE_URL / DATABASE_URL_DIRECT into the linked project's env vars. Best-effort:
 *  a project still `pending` (not yet ready) returns 409 and injection retries later. */
export async function injectConnectionEnv(database: Database): Promise<boolean> {
  if (!isRemote(database)) return false;
  const c = client();
  const branch = database.zdb_default_branch_id ?? undefined;
  const pooled = await c.getConnectionUri(database.zdb_project_id!, { branch, endpoint: "rw_pooled", reveal: true });
  const direct = await c.getConnectionUri(database.zdb_project_id!, { branch, endpoint: "rw_direct", reveal: true });
  const targets = ["production", "preview", "development"];
  await upsertEnvVar(database.project_id, "DATABASE_URL", pooled.uri, targets);
  await upsertEnvVar(database.project_id, "DATABASE_URL_DIRECT", direct.uri, targets);
  return true;
}

async function removeConnectionEnv(projectId: string): Promise<void> {
  await deleteEnvVarByKey(projectId, "DATABASE_URL");
  await deleteEnvVarByKey(projectId, "DATABASE_URL_DIRECT");
}

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
 * Re-fetch a real database's state from the control plane (pending → ready) and,
 * once ready, ensure the connection env vars are injected. Best-effort no-op for
 * simulated databases. Called when the Database page loads.
 */
export async function syncDatabaseState(database: Database): Promise<Database> {
  if (!isRemote(database)) return database;
  try {
    const proj = await client().getProject(database.zdb_project_id!);
    if (proj.state !== database.status) {
      await db.prepare("UPDATE databases SET status = ? WHERE id = ?").run(proj.state, database.id);
      await db.prepare("UPDATE db_branches SET status = ? WHERE database_id = ? AND kind = 'primary'").run(proj.state, database.id);
      database = { ...database, status: proj.state };
    }
    if (proj.state === "ready") await injectConnectionEnv(database).catch(() => {});
  } catch {
    /* control plane unreachable — keep the last-known state */
  }
  return database;
}

/**
 * Connection details for a branch. Real databases read from the control plane's
 * `/connection-uri` (masked by default; `reveal` returns the full DSN and is
 * audit-logged there). Simulated databases synthesize an endpoint-host DSN.
 */
export async function branchConnection(
  database: Database,
  branch: DbBranch,
  opts?: { reveal?: boolean }
): Promise<BranchConnection | null> {
  if (isRemote(database)) {
    try {
      const c = client();
      const res = await c.getConnectionUri(database.zdb_project_id!, {
        branch: branch.zdb_branch_id ?? undefined,
        endpoint: "rw_pooled",
        reveal: opts?.reveal ?? false,
      });
      const host = (() => {
        try {
          return new URL(res.uri).host;
        } catch {
          return endpointHost(branch, database.region);
        }
      })();
      const conn: BranchConnection = {
        branch,
        username: res.role,
        host,
        port: PORT,
        database: res.database,
        maskedConnectionString: res.revealed ? maskDsn(res.uri) : res.uri,
      };
      if (opts?.reveal && res.revealed) conn.connectionString = res.uri;
      return conn;
    } catch {
      return null; // control plane unreachable / branch not ready
    }
  }

  // Simulated mode: local credentials + synthesized DSN.
  const cred = await db
    .prepare("SELECT * FROM db_credentials WHERE branch_id = ? AND role = 'owner' ORDER BY created_at ASC LIMIT 1")
    .get<DbCredential>(branch.id);
  if (!cred) return null;
  const host = endpointHost(branch, database.region);
  const password = decryptSecret(cred.password_enc);
  const conn: BranchConnection = {
    branch,
    username: cred.username,
    host,
    port: PORT,
    database: database.name,
    maskedConnectionString: simDsn({ host, database: database.name, username: cred.username, password: "••••••••" }),
  };
  if (opts?.reveal) {
    conn.connectionString = simDsn({ host, database: database.name, username: cred.username, password });
  }
  return conn;
}
