"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiToken } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <h2 className="text-base font-medium">{title}</h2>
        {description && <p className="mt-1 max-w-lg text-[13px] text-fg-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-end border-t border-edge bg-background/50 px-6 py-3.5">
          {footer}
        </div>
      )}
    </Card>
  );
}

export function AccountSettings({
  initialName,
  email,
  initialTokens,
}: {
  initialName: string;
  email: string;
  initialTokens: ApiToken[];
}) {
  const router = useRouter();

  // profile
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);

  // password
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // tokens
  const [tokens, setTokens] = useState(initialTokens);
  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(false);
    if (res.ok) {
      setSavedName(true);
      router.refresh();
      setTimeout(() => setSavedName(false), 2500);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setSavingPw(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingPw(false);
    if (!res.ok) {
      setPwError(data.error ?? "Failed to update password");
      return;
    }
    setCurrent("");
    setNext("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    setCreatingToken(true);
    setFreshToken(null);
    const res = await fetch("/api/account/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: tokenName }),
    });
    const data = await res.json().catch(() => ({}));
    setCreatingToken(false);
    if (res.ok) {
      setTokens((prev) => [data.record, ...prev]);
      setFreshToken(data.token);
      setTokenName("");
    }
  }

  async function revokeToken(tokenId: string) {
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    await fetch(`/api/account/tokens/${tokenId}`, { method: "DELETE" });
  }

  async function copyFreshToken() {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Section
        title="Display Name"
        description="Shown in the dashboard and recorded in project activity."
        footer={
          <div className="flex items-center gap-3">
            {savedName && <span className="text-[13px] text-success">Saved</span>}
            <Button size="sm" onClick={saveName} disabled={savingName || !name.trim()}>
              {savingName ? <Spinner className="text-background" /> : "Save"}
            </Button>
          </div>
        }
      >
        <form onSubmit={saveName} className="max-w-sm space-y-4">
          <div>
            <Label htmlFor="acc-name">Name</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} disabled className="opacity-60" />
          </div>
        </form>
      </Section>

      <Section
        title="Change Password"
        footer={
          <div className="flex items-center gap-3">
            {pwSaved && <span className="text-[13px] text-success">Password updated</span>}
            <Button size="sm" onClick={savePassword} disabled={savingPw || !current || next.length < 8}>
              {savingPw ? <Spinner className="text-background" /> : "Update Password"}
            </Button>
          </div>
        }
      >
        <form onSubmit={savePassword} className="grid max-w-lg gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="pw-next">New password</Label>
            <Input
              id="pw-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          {pwError && (
            <p className="col-span-full rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {pwError}
            </p>
          )}
        </form>
      </Section>

      <Card className="overflow-hidden">
        <div className="p-6">
          <h2 className="text-base font-medium">API Tokens</h2>
          <p className="mt-1 max-w-lg text-[13px] text-fg-muted">
            Personal access tokens authenticate against the REST API — send them as{" "}
            <span className="font-mono text-fg">Authorization: Bearer &lt;token&gt;</span>.
            The token value is shown only once, at creation.
          </p>

          <form onSubmit={createToken} className="mt-5 flex max-w-lg gap-3">
            <Input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="ci-deployments"
              required
            />
            <Button type="submit" disabled={creatingToken || !tokenName} className="shrink-0">
              {creatingToken ? <Spinner className="text-background" /> : "Create Token"}
            </Button>
          </form>

          {freshToken && (
            <div className="mt-4 flex max-w-lg items-center gap-3 rounded-md border border-success/40 bg-success/10 px-4 py-3">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{freshToken}</code>
              <Button variant="secondary" size="sm" onClick={copyFreshToken}>
                {tokenCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          )}
        </div>

        {tokens.length > 0 && (
          <div className="divide-y divide-edge border-t border-edge">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-fg-faint">
                    Created {timeAgo(t.created_at)}
                    {t.last_used ? ` · Last used ${timeAgo(t.last_used)}` : " · Never used"}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => revokeToken(t.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
