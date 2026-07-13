import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDeploymentForUser, getLogs, getProject } from "@/lib/data";
import { DeploymentView } from "@/components/deployment-view";

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
  const project = getProject(user.id, id);
  if (!project) notFound();
  const deployment = getDeploymentForUser(user.id, deploymentId);
  if (!deployment || deployment.project_id !== project.id) notFound();

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
        initialLogs={getLogs(deployment.id)}
        projectId={project.id}
      />
    </main>
  );
}
