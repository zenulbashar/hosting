import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listTeamsForUser } from "@/lib/teams";
import { NewProjectForm } from "@/components/new-project-form";

export const metadata: Metadata = { title: "New Project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { team } = await searchParams;
  const teams = listTeamsForUser(user.id).map((t) => ({ id: t.id, name: t.name }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s build something new.</h1>
      <p className="mt-2 text-sm text-fg-muted">
        To deploy a new project, import an existing git repository. Zale will
        detect your framework, run the build, and put the result on the edge.
      </p>
      <div className="mt-8">
        <NewProjectForm teams={teams} initialTeamId={teams.some((t) => t.id === team) ? team ?? null : null} />
      </div>
    </main>
  );
}
