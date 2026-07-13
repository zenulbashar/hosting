import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listProjectsWithLatestDeployment } from "@/lib/data";
import { ProjectGrid } from "@/components/project-grid";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = listProjectsWithLatestDeployment(user.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="sr-only">Projects</h1>
      <ProjectGrid initial={projects} />
    </main>
  );
}
