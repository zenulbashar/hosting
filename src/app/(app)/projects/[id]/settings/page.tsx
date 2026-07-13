import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { ProjectSettings } from "@/components/settings-forms";
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
  const project = getProject(user.id, id);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Settings" />
      <ProjectSettings project={project} />
    </main>
  );
}
