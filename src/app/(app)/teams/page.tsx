import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listTeamsForUser, listMembers } from "@/lib/teams";
import { listTeamProjects } from "@/lib/data";
import { TeamCreateForm } from "@/components/team-manager";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const teams = listTeamsForUser(user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Teams"
        description="Share projects with your teammates. Members see and manage every project in the team scope."
      />

      <Card className="p-6">
        <h2 className="text-sm font-medium">Create a Team</h2>
        <div className="mt-4 max-w-md">
          <TeamCreateForm />
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {teams.map((t) => {
          const members = listMembers(t.id);
          const projects = listTeamProjects(t.id);
          return (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="flex items-center gap-4 rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-edge-strong hover:bg-surface-hover"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest text-base font-semibold">
                {t.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.name}</div>
                <div className="text-[13px] text-fg-muted">
                  {members.length} member{members.length === 1 ? "" : "s"} · {projects.length} project
                  {projects.length === 1 ? "" : "s"}
                </div>
              </div>
              <Badge tone={t.role === "owner" ? "accent" : "default"}>
                {t.role === "owner" ? "Owner" : "Member"}
              </Badge>
            </Link>
          );
        })}
        {teams.length === 0 && (
          <p className="pt-4 text-center text-sm text-fg-muted">
            You&apos;re not in any teams yet — create one above.
          </p>
        )}
      </div>
    </main>
  );
}
