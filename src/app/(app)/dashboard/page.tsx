import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listProjectsWithLatestDeployment, type Scope } from "@/lib/data";
import { getTeamForUser } from "@/lib/teams";
import { ProjectGrid } from "@/components/project-grid";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { scope: scopeParam } = await searchParams;
  const team = scopeParam ? getTeamForUser(user.id, scopeParam) : undefined;
  const scope: Scope = team ? { type: "team", teamId: team.id } : { type: "personal" };
  const projects = listProjectsWithLatestDeployment(user.id, scope);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="sr-only">{team ? `${team.name} projects` : "Projects"}</h1>
      <ProjectGrid initial={projects} scope={team?.id ?? null} />
    </main>
  );
}
