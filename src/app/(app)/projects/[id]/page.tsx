import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  currentProductionDeployment,
  getProject,
  latestDeployment,
  listDeployments,
  listDomains,
} from "@/lib/data";
import { deploymentUrl, IN_FLIGHT, repoLabel, timeAgo } from "@/lib/format";
import { getFramework } from "@/lib/frameworks";
import {
  AutoRefresh,
  RedeployButton,
  VisitButton,
} from "@/components/deployment-bits";
import { Badge, ButtonLink, Card, StatusDot } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) notFound();

  const production = currentProductionDeployment(project.id);
  const latest = latestDeployment(project.id);
  const recent = listDeployments(project.id, 5);
  const domains = listDomains(project.id);
  const fw = getFramework(project.framework);
  const anyInFlight = recent.some((d) => IN_FLIGHT.has(d.status));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AutoRefresh active={anyInFlight} />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface text-lg" aria-hidden>
            {fw.icon}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-fg-muted">{repoLabel(project.repo_url)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <RedeployButton projectId={project.id} />
          {production && <VisitButton urlSlug={production.url_slug} />}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Production deployment */}
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-fg-muted">Production Deployment</h2>
            {latest && IN_FLIGHT.has(latest.status) && (
              <Badge tone="warning">Build in progress…</Badge>
            )}
          </div>

          {production ? (
            <div className="space-y-5">
              {/* Browser-frame preview */}
              <a
                href={`/preview/${production.url_slug}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-edge transition-colors hover:border-edge-strong"
              >
                <div className="flex items-center gap-1.5 border-b border-edge bg-background px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-edge-strong" />
                  <span className="ml-2 truncate rounded bg-surface px-2 py-0.5 text-[11px] text-fg-muted">
                    {deploymentUrl(production.url_slug)}
                  </span>
                </div>
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-[#101014] to-[#16161c]">
                  <div className="text-center">
                    <div className="text-2xl" aria-hidden>{fw.icon}</div>
                    <div className="mt-2 text-sm font-medium">{project.name}</div>
                    <div className="text-xs text-fg-faint">Click to open preview</div>
                  </div>
                </div>
              </a>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs text-fg-faint">Status</dt>
                  <dd className="mt-1"><StatusDot status={production.status} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-faint">Created</dt>
                  <dd className="mt-1">{timeAgo(production.created_at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-fg-faint">Domains</dt>
                  <dd className="mt-1 space-y-1">
                    <a
                      href={`/preview/${production.url_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[#52a8ff] hover:underline"
                    >
                      {deploymentUrl(project.slug)}
                    </a>
                    {domains.filter((d) => d.verified === 1).map((d) => (
                      <a
                        key={d.id}
                        href={`/preview/${production.url_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[#52a8ff] hover:underline"
                      >
                        {d.name}
                      </a>
                    ))}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-fg-faint">Source</dt>
                  <dd className="mt-1 flex items-center gap-2 font-mono text-[13px]">
                    <span>{production.branch}</span>
                    <span className="text-fg-faint">{production.commit_sha.slice(0, 7)}</span>
                    <span className="truncate font-sans text-fg-muted">{production.commit_msg}</span>
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-fg-muted">
              {latest && IN_FLIGHT.has(latest.status)
                ? "First deployment is building — it will be promoted to production when ready."
                : "No production deployment yet."}
            </div>
          )}
        </Card>

        {/* Side column */}
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-medium text-fg-muted">Project Details</h2>
            <dl className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-fg-muted">Framework</dt>
                <dd className="flex items-center gap-2"><span aria-hidden>{fw.icon}</span>{fw.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-fg-muted">Node.js</dt>
                <dd className="font-mono text-[13px]">{project.node_version}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-fg-muted">Root directory</dt>
                <dd className="font-mono text-[13px]">{project.root_dir}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-fg-muted">Created</dt>
                <dd>{timeAgo(project.created_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-fg-muted">Domains</dt>
                <dd>
                  <Link href={`/projects/${project.id}/domains`} className="text-[#52a8ff] hover:underline">
                    {domains.length} configured
                  </Link>
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 pb-2 pt-5">
              <h2 className="text-sm font-medium text-fg-muted">Recent Deployments</h2>
              <ButtonLink href={`/projects/${project.id}/deployments`} variant="ghost" size="sm">
                View All
              </ButtonLink>
            </div>
            {recent.length === 0 ? (
              <p className="px-6 pb-6 pt-2 text-sm text-fg-muted">No deployments yet.</p>
            ) : (
              <div className="divide-y divide-edge border-t border-edge">
                {recent.map((d) => (
                  <Link
                    key={d.id}
                    href={`/projects/${project.id}/deployments/${d.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 text-sm transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <StatusDot status={d.status} withLabel={false} />
                      <span className="truncate">{d.commit_msg}</span>
                    </span>
                    <span className="shrink-0 text-xs text-fg-faint">{timeAgo(d.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
