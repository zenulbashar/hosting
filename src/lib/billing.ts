import { db } from "./db";
import { listProjects } from "./data";
import { generateMetrics } from "./metrics";

export type PlanId = "hobby" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  pricePerMonth: number;
  quotas: {
    /** bytes per 30 days */
    bandwidth: number;
    /** requests per 30 days */
    requests: number;
    /** build minutes per 30 days */
    buildMinutes: number;
    projects: number;
    /** Zale DB databases (top-level, not preview branches) */
    databases: number;
  };
};

export const PLANS: Record<PlanId, Plan> = {
  hobby: {
    id: "hobby",
    name: "Hobby",
    pricePerMonth: 0,
    quotas: {
      bandwidth: 100 * 1e9, // 100 GB
      requests: 1_000_000,
      buildMinutes: 6_000,
      projects: 10,
      databases: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    pricePerMonth: 20,
    quotas: {
      bandwidth: 1e12, // 1 TB
      requests: 10_000_000,
      buildMinutes: 24_000,
      projects: 200,
      databases: 20,
    },
  },
};

export async function getPlan(userId: string): Promise<Plan> {
  const row = await db
    .prepare("SELECT plan FROM user_plans WHERE user_id = ?")
    .get<{ plan: string }>(userId);
  // Object.hasOwn, not bracket truthiness — otherwise a stored inherited key
  // ("__proto__", "constructor", …) would resolve to a non-Plan object.
  const plan = row?.plan;
  return plan && Object.hasOwn(PLANS, plan) ? PLANS[plan as PlanId] : PLANS.hobby;
}

export async function setPlan(userId: string, plan: PlanId): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_plans (user_id, plan, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, updated_at = excluded.updated_at`
    )
    .run(userId, plan, Date.now());
}

export type ProjectUsage = {
  projectId: string;
  projectName: string;
  requests: number;
  bandwidth: number;
  buildMinutes: number;
  deployments: number;
};

export type Usage = {
  requests: number;
  bandwidth: number;
  buildMinutes: number;
  deployments: number;
  projects: number;
  databases: number;
  perProject: ProjectUsage[];
};

/**
 * Usage for the trailing 30 days. Build minutes and deployment counts come
 * from real deployment records; traffic comes from the same deterministic
 * sample metrics the analytics pages show, until real ingestion exists.
 */
export async function computeUsage(userId: string): Promise<Usage> {
  const since = Date.now() - 30 * 86_400_000;
  const projects = await listProjects(userId);

  const perProject: ProjectUsage[] = await Promise.all(
    projects.map(async (p) => {
      const traffic = generateMetrics(p.id, 30);
      const requests = traffic.reduce((a, d) => a + d.requests, 0);
      const bandwidth = traffic.reduce((a, d) => a + d.bandwidth, 0);
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(duration_ms), 0) AS build_ms
           FROM deployments WHERE project_id = ? AND created_at > ?`
        )
        .get<{ count: number; build_ms: number }>(p.id, since);
      const count = Number(row?.count ?? 0);
      const buildMs = Number(row?.build_ms ?? 0);
      return {
        projectId: p.id,
        projectName: p.name,
        requests,
        bandwidth,
        buildMinutes: Math.round((buildMs / 60_000) * 10) / 10,
        deployments: count,
      };
    })
  );

  // Top-level databases across the user's personal projects (preview branches
  // don't count — only databases the user provisioned).
  const dbRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM databases d
       JOIN projects p ON d.project_id = p.id
       WHERE p.user_id = ? AND p.team_id IS NULL`
    )
    .get<{ n: number }>(userId);

  return {
    requests: perProject.reduce((a, p) => a + p.requests, 0),
    bandwidth: perProject.reduce((a, p) => a + p.bandwidth, 0),
    buildMinutes: Math.round(perProject.reduce((a, p) => a + p.buildMinutes, 0) * 10) / 10,
    deployments: perProject.reduce((a, p) => a + p.deployments, 0),
    projects: projects.length,
    databases: Number(dbRow?.n ?? 0),
    perProject,
  };
}

export type Invoice = {
  id: string;
  period: string;
  amount: number;
  status: "paid" | "upcoming";
};

/** Mock invoice history: one paid invoice per full month since signup. */
export async function listInvoices(userId: string, createdAt: number): Promise<Invoice[]> {
  const plan = await getPlan(userId);
  const invoices: Invoice[] = [];
  const now = new Date();
  const start = new Date(createdAt);
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);

  invoices.push({
    id: `INV-${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    period: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    amount: plan.pricePerMonth,
    status: "upcoming",
  });

  for (let i = 0; i < 12; i++) {
    cursor.setMonth(cursor.getMonth() - 1);
    if (cursor < new Date(start.getFullYear(), start.getMonth(), 1)) break;
    invoices.push({
      id: `INV-${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      period: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      amount: plan.pricePerMonth,
      status: "paid",
    });
  }
  return invoices;
}
