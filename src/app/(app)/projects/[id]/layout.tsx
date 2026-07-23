import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { TabNav } from "@/components/nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  const base = `/projects/${project.id}`;
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-edge bg-background/90 backdrop-blur">
        <TabNav
          tabs={[
            { label: "Overview", href: base, exact: true },
            { label: "Deployments", href: `${base}/deployments` },
            { label: "Logs", href: `${base}/logs` },
            { label: "Analytics", href: `${base}/analytics` },
            { label: "Activity", href: `${base}/activity` },
            { label: "Domains", href: `${base}/domains` },
            { label: "Database", href: `${base}/database` },
            { label: "Environment", href: `${base}/environment` },
            { label: "Settings", href: `${base}/settings` },
          ]}
        />
      </div>
      {children}
    </>
  );
}
