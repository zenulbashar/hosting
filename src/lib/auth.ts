import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { id } from "./utils";

const SESSION_COOKIE = "hosting_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: number;
};

// ---------- password hashing (scrypt, no native deps) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- users ----------

export function createUser(email: string, name: string, password: string): User {
  const user = {
    id: id("usr"),
    email: email.toLowerCase().trim(),
    name: name.trim(),
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(user.id, user.email, user.name, hashPassword(password), user.created_at);
  return user;
}

export function findUserByEmail(email: string): (User & { password_hash: string }) | undefined {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as (User & { password_hash: string }) | undefined;
}

// ---------- sessions ----------

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.created_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`
      )
      .get(token, Date.now()) as User | undefined;
    if (row) return row;
  }
  // API access: Authorization: Bearer nbt_xxx (personal access token)
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return getUserByApiToken(auth.slice(7).trim());
  }
  return null;
}

// ---------- personal access tokens ----------

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type ApiToken = {
  id: string;
  user_id: string;
  name: string;
  last_used: number | null;
  created_at: number;
};

/** Creates a token and returns the plaintext once — only the hash is stored. */
export function createApiToken(userId: string, name: string): { token: string; record: ApiToken } {
  const token = `nbt_${crypto.randomBytes(20).toString("hex")}`;
  const record: ApiToken = {
    id: id("tok"),
    user_id: userId,
    name: name.trim(),
    last_used: null,
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO api_tokens (id, user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(record.id, record.user_id, record.name, hashToken(token), record.created_at);
  return { token, record };
}

export function listApiTokens(userId: string): ApiToken[] {
  return db
    .prepare(
      "SELECT id, user_id, name, last_used, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(userId) as ApiToken[];
}

export function deleteApiToken(userId: string, tokenId: string): boolean {
  const res = db
    .prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?")
    .run(tokenId, userId);
  return res.changes > 0;
}

function getUserByApiToken(token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at, t.id AS token_id
       FROM api_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`
    )
    .get(hashToken(token)) as (User & { token_id: string }) | undefined;
  if (!row) return null;
  db.prepare("UPDATE api_tokens SET last_used = ? WHERE id = ?").run(Date.now(), row.token_id);
  return { id: row.id, email: row.email, name: row.name, created_at: row.created_at };
}

// ---------- account updates ----------

export function updateUserName(userId: string, name: string): void {
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), userId);
}

/** Returns false if the current password doesn't match. */
export function updateUserPassword(userId: string, current: string, next: string): boolean {
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(userId) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(current, row.password_hash)) return false;
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), userId);
  return true;
}
