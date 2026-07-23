"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamInviteView } from "@/lib/teams";
import { Badge, Button, Card, Spinner } from "@/components/ui";

/** Incoming team invitations for the current user, with explicit accept/decline. */
export function PendingInvites({ initial }: { initial: TeamInviteView[] }) {
  const router = useRouter();
  const [invites, setInvites] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function respond(inviteId: string, action: "accept" | "decline") {
    setBusy(inviteId);
    const res = await fetch(`/api/teams/invites/${inviteId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (res.ok) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      router.refresh();
    }
  }

  return (
    <Card className="mb-6 overflow-hidden border-accent/40">
      <div className="border-b border-edge px-6 py-4">
        <h2 className="text-sm font-medium">
          Invitations <span className="ml-1 text-fg-faint">({invites.length})</span>
        </h2>
      </div>
      <div className="divide-y divide-edge">
        {invites.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{inv.team_name}</div>
              <div className="mt-0.5 text-xs text-fg-faint">
                You&apos;ve been invited as {inv.role === "owner" ? "an owner" : "a member"}
              </div>
            </div>
            <Badge tone="accent">Pending</Badge>
            <Button size="sm" onClick={() => respond(inv.id, "accept")} disabled={busy === inv.id}>
              {busy === inv.id ? <Spinner className="text-background" /> : "Accept"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => respond(inv.id, "decline")} disabled={busy === inv.id}>
              Decline
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
