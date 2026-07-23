import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { generateMetrics } from "@/lib/metrics";
import { AnalyticsDashboard } from "@/components/analytics";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  // 180 days so every range still has a full previous period for deltas.
  const metrics = generateMetrics(project.id, 180);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Analytics"
        description="Traffic served by the edge network for this project. Sample data until real ingestion is connected."
      />
      <AnalyticsDashboard metrics={metrics} />
    </main>
  );
}
