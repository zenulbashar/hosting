"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProjectWithDeployment } from "@/lib/data";
import { deploymentUrl, IN_FLIGHT, repoLabel, timeAgo } from "@/lib/format";
import { getFramework } from "@/lib/frameworks";
import { ButtonLink, EmptyState, Input, StatusDot } from "@/components/ui";

export function ProjectGrid({ initial }: { initial: ProjectWithDeployment[] }) {
  const [projects, setProjects] = useState(initial);
  const [query, setQuery] = useState("");

  // Poll while any project has a deployment in flight so cards update live.
  const anyInFlight = projects.some((p) => p.deployment && IN_FLIGHT.has(p.deployment.status));
  useEffect(() => {
    if (!anyInFlight) return;
    const t = setInterval(async () => {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [anyInFlight]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.repo_url.toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className="pl-9"
          />
        </div>
        <ButtonLink href="/new" className="shrink-0">
          Add New Project
        </ButtonLink>
      </div>

      {filtered.length === 0 ? (
        query ? (
          <EmptyState
            title="No projects found"
            description={`No projects match “${query}”. Try a different search.`}
          />
        ) : (
          <EmptyState
            title="Deploy your first project"
            description="Import a git repository and Nimbus will build and deploy it to the edge in seconds."
            action={<ButtonLink href="/new">Import Project</ButtonLink>}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const fw = getFramework(p.framework);
            const d = p.deployment;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-edge-strong hover:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-background text-base"
                      aria-hidden
                    >
                      {fw.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="truncate text-[13px] text-fg-muted">
                        {d ? deploymentUrl(p.slug) : "Not deployed"}
                      </div>
                    </div>
                  </div>
                  {d && <StatusDot status={d.status} withLabel={false} />}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-full border border-edge bg-background px-3 py-1.5 text-xs text-fg-muted">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.25 10.25 0 0022 12.25C22 6.58 17.52 2 12 2z" />
                  </svg>
                  <span className="truncate">{repoLabel(p.repo_url)}</span>
                </div>

                {d && (
                  <div className="mt-3 text-[13px] text-fg-muted">
                    <div className="truncate">{d.commit_msg}</div>
                    <div className="mt-0.5 text-fg-faint">
                      {timeAgo(d.created_at)} on{" "}
                      <span className="font-mono text-xs">{d.branch}</span>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
