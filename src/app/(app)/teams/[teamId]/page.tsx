import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTeamForUser, listInvites, listMembers } from "@/lib/teams";
import { TeamManager } from "@/components/team-manager";
import { ButtonLink, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { teamId } = await params;
  const team = await getTeamForUser(user.id, teamId);
  if (!team) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/teams" className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All Teams
      </Link>
      <PageHeader
        title={team.name}
        description={`Team scope · you are ${team.role === "owner" ? "an owner" : "a member"}`}
        actions={
          <ButtonLink href={`/dashboard?scope=${team.id}`} variant="secondary" size="sm">
            View Projects
          </ButtonLink>
        }
      />
      <TeamManager
        team={team}
        members={await listMembers(team.id)}
        invites={await listInvites(team.id)}
        currentUserId={user.id}
      />
    </main>
  );
}
