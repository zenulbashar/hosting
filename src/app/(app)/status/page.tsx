import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listRegionHealth } from "@/lib/region-health";
import { isAdmin } from "@/lib/config";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { StatusView } from "@/components/status-view";

export const metadata: Metadata = { title: "Region Status" };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [regions, counts] = await Promise.all([
    listRegionHealth(),
    db
      .prepare("SELECT region, COUNT(*) AS n FROM deployment_regions WHERE status = 'ready' GROUP BY region")
      .all<{ region: string; n: number }>(),
  ]);
  const byRegion = new Map(counts.map((c) => [c.region, Number(c.n)]));
  const initial = regions.map((r) => ({ ...r, deployments: byRegion.get(r.region) ?? 0 }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Region Status"
        description="Health of the Zale global edge. Deployments roll out across every operational region and traffic fails over automatically when one degrades."
      />
      <StatusView initial={initial} canManage={isAdmin(user.email)} />
    </main>
  );
}
