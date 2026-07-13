import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { getFramework } from "@/lib/frameworks";
import { RuntimeLogs } from "@/components/runtime-logs";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Logs" };
export const dynamic = "force-dynamic";

export default async function LogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) notFound();

  const fw = getFramework(project.framework);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Logs"
        description={
          fw.kind === "agent"
            ? "Live output from the always-on agent runtime — tasks, heartbeats and errors. Sample stream until real ingestion is connected."
            : "Live request logs from the edge. Sample stream until real ingestion is connected."
        }
      />
      <RuntimeLogs kind={fw.kind} region={project.region} />
    </main>
  );
}
