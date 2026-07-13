import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function createDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "hosting.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      slug           TEXT NOT NULL,
      repo_url       TEXT NOT NULL,
      framework      TEXT NOT NULL,
      root_dir       TEXT NOT NULL DEFAULT './',
      build_command  TEXT,
      output_dir     TEXT,
      install_command TEXT,
      node_version   TEXT NOT NULL DEFAULT '22.x',
      region         TEXT NOT NULL DEFAULT 'syd1',
      created_at     INTEGER NOT NULL,
      UNIQUE(user_id, slug)
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url_slug     TEXT NOT NULL UNIQUE,
      status       TEXT NOT NULL DEFAULT 'QUEUED',
      environment  TEXT NOT NULL DEFAULT 'production',
      branch       TEXT NOT NULL DEFAULT 'main',
      commit_sha   TEXT NOT NULL,
      commit_msg   TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      finished_at  INTEGER,
      duration_ms  INTEGER,
      is_current   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS deployment_logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
      ts            INTEGER NOT NULL,
      level         TEXT NOT NULL DEFAULT 'info',
      message       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_deployment ON deployment_logs(deployment_id, id);

    CREATE TABLE IF NOT EXISTS env_vars (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key         TEXT NOT NULL,
      value       TEXT NOT NULL,
      targets     TEXT NOT NULL DEFAULT 'production,preview,development',
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domains (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL UNIQUE,
      verified    INTEGER NOT NULL DEFAULT 0,
      is_primary  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      last_used  INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deploy_hooks (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      branch     TEXT NOT NULL DEFAULT 'main',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS team_invites (
      id         TEXT PRIMARY KEY,
      team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      email      TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      UNIQUE(team_id, email)
    );

    CREATE TABLE IF NOT EXISTS user_plans (
      user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan       TEXT NOT NULL DEFAULT 'hobby',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      actor      TEXT NOT NULL,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_project ON activity(project_id, id DESC);
  `);

  // Lightweight migrations for databases created before a column existed.
  ensureColumn(db, "projects", "region", "region TEXT NOT NULL DEFAULT 'syd1'");
  ensureColumn(db, "projects", "team_id", "team_id TEXT");

  return db;
}

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// Cache on globalThis so Next.js dev-mode HMR doesn't open duplicate handles.
const globalForDb = globalThis as unknown as { __hostingDb?: Database.Database };

export const db: Database.Database = globalForDb.__hostingDb ?? createDb();
globalForDb.__hostingDb = db;
