import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAdministerProject, getProject, listDeployHooks } from "@/lib/data";
import { ProjectSettings } from "@/components/settings-forms";
import { HooksManager } from "@/components/hooks-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const canAdminister = await canAdministerProject(user.id, project);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <HooksManager projectId={project.id} initial={await listDeployHooks(project.id)} />
        <ProjectSettings project={project} canAdminister={canAdminister} />
      </div>
    </main>
  );
}
