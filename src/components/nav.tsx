"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";

export type NavTeam = { id: string; name: string };

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#0070f3] text-sm font-semibold text-white ring-1 ring-white/20 transition-transform hover:scale-105"
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-lg border border-edge bg-surface shadow-xl shadow-black/50">
          <div className="border-b border-edge px-4 py-3">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-fg-muted">{email}</div>
          </div>
          <div className="p-1.5">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Dashboard
            </Link>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Account Settings
            </Link>
            <Link
              href="/usage"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Usage &amp; Billing
            </Link>
            <Link
              href="/audit"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Security &amp; Audit Log
            </Link>
            <Link
              href="/teams"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Teams
            </Link>
            <button
              onClick={logout}
              className="block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Top navigation for the authenticated app: logo → scope breadcrumb, plus
 * project name when inside a project.
 */
/** Scope dropdown: Personal + the user's teams. Reads ?scope= from the URL. */
function ScopeSwitcherInner({
  userName,
  planName,
  teams,
}: {
  userName: string;
  planName: string;
  teams: NavTeam[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");
  const activeTeam = teams.find((t) => t.id === scope);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(target: string | null) {
    setOpen(false);
    router.push(target ? `/dashboard?scope=${target}` : "/dashboard");
  }

  return (
    <div className="relative flex min-w-0 items-center gap-2" ref={ref}>
      <Link href={activeTeam ? `/dashboard?scope=${activeTeam.id}` : "/dashboard"} className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <span className="truncate">{activeTeam ? activeTeam.name : userName}</span>
        <span className="rounded-full border border-edge-strong px-2 py-0.5 text-[11px] text-fg-muted">
          {activeTeam ? "Team" : planName}
        </span>
      </Link>
      <button
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-fg"
        aria-label="Switch scope"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-56 overflow-hidden rounded-lg border border-edge bg-surface shadow-xl shadow-black/50">
          <div className="p-1.5">
            <button
              onClick={() => go(null)}
              className={`block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover ${!activeTeam ? "text-fg" : "text-fg-muted"}`}
            >
              {userName} <span className="text-xs text-fg-faint">(Personal)</span>
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover ${activeTeam?.id === t.id ? "text-fg" : "text-fg-muted"}`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="border-t border-edge p-1.5">
            <Link
              href="/teams"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              Create or manage teams…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardNav({
  userName,
  email,
  planName = "Hobby",
  teams = [],
  projectName,
  projectId,
}: {
  userName: string;
  email: string;
  planName?: string;
  teams?: NavTeam[];
  projectName?: string;
  projectId?: string;
}) {
  return (
    <div className="flex h-16 items-center justify-between px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard" className="text-fg">
          <LogoMark size={24} />
        </Link>
        <svg className="h-5 w-5 shrink-0 text-edge-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 3L8 21" />
        </svg>
        <Suspense
          fallback={<span className="truncate text-sm font-medium">{userName}</span>}
        >
          <ScopeSwitcherInner userName={userName} planName={planName} teams={teams} />
        </Suspense>
        {projectName && projectId && (
          <>
            <svg className="h-5 w-5 shrink-0 text-edge-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 3L8 21" />
            </svg>
            <Link href={`/projects/${projectId}`} className="truncate text-sm font-medium">
              {projectName}
            </Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden cursor-default text-[13px] text-fg-muted sm:block">
          Docs
        </span>
        <UserMenu name={userName} email={email} />
      </div>
    </div>
  );
}

/** Underlined tab row (dashboard-level or project-level). */
export function TabNav({ tabs }: { tabs: { label: string; href: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative whitespace-nowrap px-3 pb-3 pt-1 text-sm transition-colors ${
              active ? "text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-fg" />}
          </Link>
        );
      })}
    </nav>
  );
}
