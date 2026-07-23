import { db } from "./db";

export type ActivityEvent = {
  id: number;
  project_id: string;
  actor: string;
  type: string;
  message: string;
  created_at: number;
};

export async function recordActivity(
  projectId: string,
  actor: string,
  type: string,
  message: string
): Promise<void> {
  await db
    .prepare("INSERT INTO activity (project_id, actor, type, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(projectId, actor, type, message, Date.now());
}

export function listActivity(projectId: string, limit = 100): Promise<ActivityEvent[]> {
  return db
    .prepare("SELECT * FROM activity WHERE project_id = ? ORDER BY id DESC LIMIT ?")
    .all<ActivityEvent>(projectId, limit);
}
