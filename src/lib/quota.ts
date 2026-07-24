/**
 * Plan quota enforcement.
 *
 * The usage meters (billing.ts) become real limits here: each `check*` returns
 * a structured verdict a route can turn into a 402 with an actionable message.
 * Enforcement is scoped to the acting user's *personal* resources — exactly the
 * scope the Usage page displays — so what a user is blocked on always matches
 * what their meters show. Team-scoped resources are governed by the team (a
 * separate billing entity) and are intentionally not counted against a personal
 * plan; callers skip the check for team-scoped creates.
 */
import { db } from "./db";
import { getPlan, computeUsage } from "./billing";

export type QuotaResource = "projects" | "databases" | "buildMinutes";

export type QuotaCheck = {
  ok: boolean;
  resource: QuotaResource;
  used: number;
  limit: number;
  planName: string;
  /** Present only when `ok` is false — a user-facing explanation. */
  message?: string;
};

async function scalar(sql: string, ...args: unknown[]): Promise<number> {
  const row = await db.prepare(sql).get<{ n: number }>(...args);
  return Number(row?.n ?? 0);
}

function verdict(resource: QuotaResource, used: number, limit: number, planName: string, unit: string): QuotaCheck {
  const ok = used < limit;
  const unitText = limit === 1 ? unit.replace(/s$/, "") : unit;
  return {
    ok,
    resource,
    used,
    limit,
    planName,
    message: ok
      ? undefined
      : `You've reached the ${planName} plan limit of ${limit} ${unitText}. Upgrade your plan to add more.`,
  };
}

/** Can this user create another personal project? */
export async function checkProjectQuota(userId: string): Promise<QuotaCheck> {
  const plan = await getPlan(userId);
  const used = await scalar("SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND team_id IS NULL", userId);
  return verdict("projects", used, plan.quotas.projects, plan.name, "projects");
}

/** Can this user provision another database on a personal project? */
export async function checkDatabaseQuota(userId: string): Promise<QuotaCheck> {
  const plan = await getPlan(userId);
  const used = await scalar(
    `SELECT COUNT(*) AS n FROM databases d
     JOIN projects p ON d.project_id = p.id
     WHERE p.user_id = ? AND p.team_id IS NULL`,
    userId
  );
  return verdict("databases", used, plan.quotas.databases, plan.name, "databases");
}

/** Has this user's trailing-30-day build-minute budget been exhausted? */
export async function checkBuildMinutesQuota(userId: string): Promise<QuotaCheck> {
  const plan = await getPlan(userId);
  const usage = await computeUsage(userId);
  return verdict("buildMinutes", Math.round(usage.buildMinutes), plan.quotas.buildMinutes, plan.name, "build minutes this month");
}
