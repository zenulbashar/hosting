import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDeploymentForUser, getLogs, getProject } from "@/lib/data";
import { listDeploymentRegions } from "@/lib/region-health";
import { DeploymentView } from "@/components/deployment-view";
import { Badge, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Deployment" };
export const dynamic = "force-dynamic";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string; deploymentId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, deploymentId } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const deployment = await getDeploymentForUser(user.id, deploymentId);
  if (!deployment || deployment.project_id !== project.id) notFound();

  const regions = await listDeploymentRegions(deployment.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/projects/${project.id}/deployments`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All Deployments
      </Link>
      <DeploymentView
        initial={deployment}
        initialLogs={await getLogs(deployment.id)}
        projectId={project.id}
      />

      {regions.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-edge px-6 py-4">
            <h2 className="text-sm font-medium">Regional rollout</h2>
            <p className="mt-1 text-xs text-fg-faint">
              Where this deployment is served from across the Zale global edge.
            </p>
          </div>
          <div className="divide-y divide-edge">
            {regions.map((r) => (
              <div key={r.region} className="flex items-center gap-4 px-6 py-3">
                <span aria-hidden>{r.meta.flag}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm">{r.meta.city}</span>
                  <span className="ml-2 font-mono text-xs text-fg-faint">{r.region}</span>
                  {r.role === "primary" && <span className="ml-2 text-xs text-fg-faint">· home</span>}
                </div>
                <span className="text-xs text-fg-faint">{r.latency_ms} ms</span>
                <Badge
                  tone={r.status === "ready" ? (r.health === "operational" ? "success" : "warning") : "danger"}
                >
                  {r.status === "ready" ? (r.health === "operational" ? "ready" : r.health) : "skipped"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
