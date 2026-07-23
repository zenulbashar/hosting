import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject, listDomains } from "@/lib/data";
import { DomainManager } from "@/components/domain-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Domains" };
export const dynamic = "force-dynamic";

export default async function DomainsPage({
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
        title="Domains"
        description="Custom domains served by the edge network with automatic TLS certificates."
      />
      <DomainManager
        projectId={project.id}
        projectSlug={project.slug}
        initial={await listDomains(project.id)}
      />
    </main>
  );
}
