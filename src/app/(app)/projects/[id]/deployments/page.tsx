import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject, listDeployments } from "@/lib/data";
import { DeploymentsList, RedeployButton } from "@/components/deployment-bits";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Deployments" };
export const dynamic = "force-dynamic";

export default async function DeploymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) notFound();

  const deployments = listDeployments(project.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Deployments"
        description="Every deployment for this project, newest first. Production deployments are promoted automatically on success."
        actions={
          <>
            <RedeployButton projectId={project.id} variant="secondary" label="Deploy Preview" environment="preview" />
            <RedeployButton projectId={project.id} variant="primary" label="Create Deployment" />
          </>
        }
      />
      <Card className="overflow-hidden">
        <DeploymentsList initial={deployments} projectId={project.id} />
      </Card>
    </main>
  );
}
