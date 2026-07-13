"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/logo";

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
export function DashboardNav({
  userName,
  email,
  projectName,
  projectId,
}: {
  userName: string;
  email: string;
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
        <Link
          href="/dashboard"
          className="flex items-center gap-2 truncate text-sm font-medium hover:text-fg"
        >
          <span className="truncate">{userName}</span>
          <span className="rounded-full border border-edge-strong px-2 py-0.5 text-[11px] text-fg-muted">
            Hobby
          </span>
        </Link>
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
