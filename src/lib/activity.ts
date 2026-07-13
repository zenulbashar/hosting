import { db } from "./db";

export type ActivityEvent = {
  id: number;
  project_id: string;
  actor: string;
  type: string;
  message: string;
  created_at: number;
};

export function recordActivity(
  projectId: string,
  actor: string,
  type: string,
  message: string
): void {
  db.prepare(
    "INSERT INTO activity (project_id, actor, type, message, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(projectId, actor, type, message, Date.now());
}

export function listActivity(projectId: string, limit = 100): ActivityEvent[] {
  return db
    .prepare("SELECT * FROM activity WHERE project_id = ? ORDER BY id DESC LIMIT ?")
    .all(projectId, limit) as ActivityEvent[];
}
