import { db } from "./db";
import { id, randomHex, slugify } from "./utils";

export type TeamRole = "owner" | "member";

export type Team = {
  id: string;
  name: string;
  slug: string;
  created_at: number;
};

export type TeamWithRole = Team & { role: TeamRole };

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: number;
  name: string;
  email: string;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  created_at: number;
};

export async function createTeam(userId: string, name: string): Promise<Team> {
  let slug = slugify(name);
  if (await db.prepare("SELECT 1 FROM teams WHERE slug = ?").get(slug)) {
    slug = `${slug}-${randomHex(4)}`;
  }
  const team: Team = { id: id("team"), name: name.trim(), slug, created_at: Date.now() };
  await db
    .prepare("INSERT INTO teams (id, name, slug, created_at) VALUES (?, ?, ?, ?)")
    .run(team.id, team.name, team.slug, team.created_at);
  await db
    .prepare("INSERT INTO team_members (team_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)")
    .run(team.id, userId, Date.now());
  return team;
}

export function listTeamsForUser(userId: string): Promise<TeamWithRole[]> {
  return db
    .prepare(
      `SELECT t.*, m.role FROM teams t
       JOIN team_members m ON m.team_id = t.id
       WHERE m.user_id = ? ORDER BY t.created_at ASC`
    )
    .all<TeamWithRole>(userId);
}

/** Returns the team only if the user is a member; role included. */
export function getTeamForUser(userId: string, teamId: string): Promise<TeamWithRole | undefined> {
  return db
    .prepare(
      `SELECT t.*, m.role FROM teams t
       JOIN team_members m ON m.team_id = t.id
       WHERE t.id = ? AND m.user_id = ?`
    )
    .get<TeamWithRole>(teamId, userId);
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  return !!(await db
    .prepare("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, userId));
}

export function listMembers(teamId: string): Promise<TeamMember[]> {
  return db
    .prepare(
      `SELECT m.*, u.name, u.email FROM team_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.team_id = ? ORDER BY m.created_at ASC`
    )
    .all<TeamMember>(teamId);
}

export function listInvites(teamId: string): Promise<TeamInvite[]> {
  return db
    .prepare("SELECT * FROM team_invites WHERE team_id = ? ORDER BY created_at ASC")
    .all<TeamInvite>(teamId);
}

export type TeamInviteView = TeamInvite & { team_name: string };

/**
 * Invite by email. Always creates a *pending* invite the recipient must
 * explicitly accept — membership is never granted without consent, whether or
 * not the address already has an account. Accepting is what joins them
 * (`acceptInvite`), so the role the inviter chose only takes effect on accept.
 */
export async function inviteToTeam(
  teamId: string,
  email: string,
  role: TeamRole
): Promise<{ pending: boolean }> {
  await db
    .prepare(
      `INSERT INTO team_invites (id, team_id, email, role, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(team_id, email) DO NOTHING`
    )
    .run(id("inv"), teamId, email.toLowerCase().trim(), role, Date.now());
  return { pending: true };
}

/** Pending invitations addressed to a given email, with the team name. */
export function listPendingInvitesForEmail(email: string): Promise<TeamInviteView[]> {
  return db
    .prepare(
      `SELECT i.*, t.name AS team_name FROM team_invites i
       JOIN teams t ON t.id = i.team_id
       WHERE i.email = ? ORDER BY i.created_at ASC`
    )
    .all<TeamInviteView>(email.toLowerCase().trim());
}

/** Accept an invite addressed to `email`, joining `userId` to the team. */
export async function acceptInvite(userId: string, email: string, inviteId: string): Promise<boolean> {
  const inv = await db
    .prepare("SELECT * FROM team_invites WHERE id = ? AND email = ?")
    .get<TeamInvite>(inviteId, email.toLowerCase().trim());
  if (!inv) return false;
  await db
    .prepare(
      `INSERT INTO team_members (team_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(team_id, user_id) DO NOTHING`
    )
    .run(inv.team_id, userId, inv.role, Date.now());
  await db.prepare("DELETE FROM team_invites WHERE id = ?").run(inv.id);
  return true;
}

/** Decline (delete) an invite addressed to `email`. */
export async function declineInvite(email: string, inviteId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM team_invites WHERE id = ? AND email = ?")
    .run(inviteId, email.toLowerCase().trim());
  return res.changes > 0;
}

export async function removeMember(teamId: string, userId: string): Promise<boolean> {
  // The last owner cannot be removed.
  const member = await db
    .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
    .get<{ role: TeamRole }>(teamId, userId);
  if (!member) return false;
  if (member.role === "owner") {
    const owners = await db
      .prepare("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND role = 'owner'")
      .get<{ n: number }>(teamId);
    if (Number(owners?.n ?? 0) <= 1) return false;
  }
  const res = await db
    .prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .run(teamId, userId);
  return res.changes > 0;
}

export async function deleteInvite(teamId: string, inviteId: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM team_invites WHERE id = ? AND team_id = ?")
    .run(inviteId, teamId);
  return res.changes > 0;
}

export async function renameTeam(teamId: string, name: string): Promise<void> {
  await db.prepare("UPDATE teams SET name = ? WHERE id = ?").run(name.trim(), teamId);
}

/** Owner-only. Team projects are detached back to their creators' personal scope. */
export async function deleteTeam(teamId: string): Promise<void> {
  await db.prepare("UPDATE projects SET team_id = NULL WHERE team_id = ?").run(teamId);
  await db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
}
