"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamInvite, TeamMember, TeamRole, TeamWithRole } from "@/lib/teams";
import { timeAgo } from "@/lib/format";
import { Badge, Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

export function TeamCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create team");
      return;
    }
    setName("");
    router.push(`/teams/${data.team.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={create} className="flex gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="acme-inc"
        required
        maxLength={60}
      />
      <Button type="submit" disabled={pending || !name.trim()} className="shrink-0">
        {pending ? <Spinner className="text-background" /> : "Create Team"}
      </Button>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </form>
  );
}

export function TeamManager({
  team,
  members,
  invites,
  currentUserId,
}: {
  team: TeamWithRole;
  members: TeamMember[];
  invites: TeamInvite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const isOwner = team.role === "owner";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [teamName, setTeamName] = useState(team.name);
  const [savedName, setSavedName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteMsg(null);
    setPending(true);
    const res = await fetch(`/api/teams/${team.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to invite");
      return;
    }
    setInviteMsg(
      data.joined
        ? `${email} has an account and was added to the team.`
        : `Invite stored — ${email} will join automatically when they sign up.`
    );
    setEmail("");
    router.refresh();
  }

  async function remove(memberId: string) {
    const res = await fetch(`/api/teams/${team.id}/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      if (memberId === currentUserId) {
        router.push("/dashboard");
      }
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to remove");
    }
  }

  async function rename() {
    const res = await fetch(`/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: teamName }),
    });
    if (res.ok) {
      setSavedName(true);
      router.refresh();
      setTimeout(() => setSavedName(false), 2500);
    }
  }

  async function destroy() {
    setDeleting(true);
    const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/teams");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card className="p-6">
          <h2 className="text-base font-medium">Invite Member</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            If the email already has a Zale account they join instantly;
            otherwise they join automatically on signup.
          </p>
          <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </div>
            <div className="w-32">
              <Label htmlFor="inv-role">Role</Label>
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </Select>
            </div>
            <Button type="submit" disabled={pending || !email}>
              {pending ? <Spinner className="text-background" /> : "Invite"}
            </Button>
          </form>
          {inviteMsg && (
            <p className="mt-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[13px] text-success">
              {inviteMsg}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h2 className="text-sm font-medium">
            Members <span className="ml-1 text-fg-faint">({members.length})</span>
          </h2>
        </div>
        <div className="divide-y divide-edge">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-4 px-6 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#0070f3] text-sm font-semibold text-white">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {m.name}
                  {m.user_id === currentUserId && <span className="ml-2 text-xs text-fg-faint">(you)</span>}
                </div>
                <div className="truncate text-xs text-fg-muted">{m.email}</div>
              </div>
              <Badge tone={m.role === "owner" ? "accent" : "default"}>
                {m.role === "owner" ? "Owner" : "Member"}
              </Badge>
              {(isOwner || m.user_id === currentUserId) && (
                <Button variant="ghost" size="sm" onClick={() => remove(m.user_id)}>
                  {m.user_id === currentUserId ? "Leave" : "Remove"}
                </Button>
              )}
            </div>
          ))}
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-edge-strong text-sm text-fg-faint">
                ?
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{inv.email}</div>
                <div className="text-xs text-fg-faint">Invited {timeAgo(inv.created_at)}</div>
              </div>
              <Badge tone="warning">Pending</Badge>
              {isOwner && (
                <Button variant="ghost" size="sm" onClick={() => remove(inv.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {isOwner && (
        <>
          <Card className="overflow-hidden">
            <div className="p-6">
              <h2 className="text-base font-medium">Team Name</h2>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="mt-4 max-w-sm"
                maxLength={60}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-edge bg-background/50 px-6 py-3.5">
              {savedName && <span className="text-[13px] text-success">Saved</span>}
              <Button size="sm" onClick={rename} disabled={!teamName.trim()}>
                Save
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden border-danger/40">
            <div className="p-6">
              <h2 className="text-base font-medium text-danger">Delete Team</h2>
              <p className="mt-1 max-w-lg text-[13px] text-fg-muted">
                Team projects are moved back to their creators&apos; personal scope.
                This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end border-t border-danger/30 bg-danger/5 px-6 py-3.5">
              <Button variant="danger" size="sm" onClick={destroy} disabled={deleting}>
                {deleting ? <Spinner /> : "Delete Team"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
