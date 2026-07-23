import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { branchConnection, listBranches, listDatabases } from "@/lib/zale-db";
import { DatabaseManager } from "@/components/database-manager";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Database" };
export const dynamic = "force-dynamic";

export default async function DatabasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  const databases = await listDatabases(project.id);
  const initial = await Promise.all(
    databases.map(async (database) => {
      const branches = await listBranches(database.id);
      const connections = await Promise.all(branches.map((b) => branchConnection(database, b)));
      return { ...database, branches: connections.filter((c) => c !== null) };
    })
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Database"
        description="Managed Zale DB Postgres with automatic branch-per-preview and scoped credentials."
      />
      <DatabaseManager projectId={project.id} initial={initial} />
    </main>
  );
}
