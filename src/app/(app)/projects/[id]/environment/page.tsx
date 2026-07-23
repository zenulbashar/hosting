import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject, listEnvVarsDecrypted } from "@/lib/data";
import { EnvManager } from "@/components/env-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Environment Variables" };
export const dynamic = "force-dynamic";

export default async function EnvironmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Environment Variables"
        description="Configuration and secrets available to builds and runtime, scoped per environment."
      />
      <EnvManager projectId={project.id} initial={await listEnvVarsDecrypted(project.id)} />
    </main>
  );
}
