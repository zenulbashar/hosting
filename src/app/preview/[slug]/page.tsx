import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  currentProductionDeployment,
  getDeploymentBySlug,
  type Deployment,
  type Project,
} from "@/lib/data";
import { getFramework } from "@/lib/frameworks";
import { APP_DOMAIN } from "@/lib/config";

export const metadata: Metadata = { title: "Deployment Preview" };
export const dynamic = "force-dynamic";

/**
 * Simulates what visitors would see at <slug>.<app-domain> or a custom domain.
 * Resolves either a deployment url_slug or a verified custom domain. In a real
 * datacenter this is replaced by the edge serving actual build outputs.
 */
function resolve(slug: string): { deployment: Deployment; project: Project } | null {
  let deployment = getDeploymentBySlug(slug);
  if (!deployment) {
    const domain = db
      .prepare("SELECT project_id FROM domains WHERE name = ? AND verified = 1")
      .get(slug.toLowerCase()) as { project_id: string } | undefined;
    if (domain) deployment = currentProductionDeployment(domain.project_id);
    if (!deployment) {
      // Also allow the project's stable subdomain: <project-slug>.<app-domain>
      const project = db
        .prepare("SELECT id FROM projects WHERE slug = ?")
        .get(slug.toLowerCase()) as { id: string } | undefined;
      if (project) deployment = currentProductionDeployment(project.id);
    }
  }
  if (!deployment) return null;
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(deployment.project_id) as Project | undefined;
  if (!project) return null;
  return { deployment, project };
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = resolve(decodeURIComponent(slug));

  if (!resolved) {
    return (
      <StatusShell code="404" title="Deployment not found">
        The deployment or domain you are looking for does not exist or has been removed.
      </StatusShell>
    );
  }

  const { deployment, project } = resolved;

  if (deployment.status === "ERROR" || deployment.status === "CANCELED") {
    return (
      <StatusShell code="502" title="Deployment failed">
        This deployment did not complete successfully, so there is nothing to serve.
        Check the build logs in your dashboard.
      </StatusShell>
    );
  }

  if (deployment.status !== "READY") {
    return (
      <StatusShell code="…" title="Deployment in progress">
        This deployment is still building. Refresh in a few seconds.
      </StatusShell>
    );
  }

  const fw = getFramework(project.framework);

  // Agent projects serve a status console instead of a website.
  if (fw.kind === "agent") {
    return <AgentConsole project={project} deployment={deployment} />;
  }

  // A plausible "customer site" so the deployed URL feels real.
  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-[#111]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <span className="text-lg font-semibold capitalize tracking-tight">
            {project.name.replace(/-/g, " ")}
          </span>
          <nav className="flex gap-6 text-sm text-black/60">
            <span>Home</span>
            <span>About</span>
            <span>Contact</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mx-auto w-fit rounded-full border border-black/10 bg-white px-4 py-1 text-xs text-black/50">
          Powered by {fw.name}
        </p>
        <h1 className="mt-6 text-5xl font-bold capitalize tracking-tight">
          {project.name.replace(/-/g, " ")}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-black/60">
          This site was built from{" "}
          <span className="font-mono text-sm">{deployment.branch}@{deployment.commit_sha.slice(0, 7)}</span>{" "}
          and deployed to the Zale edge network.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {["Fast", "Secure", "Global"].map((t, i) => (
            <div key={t} className="rounded-xl border border-black/10 bg-white p-6 text-left shadow-sm">
              <div className="text-2xl">{["⚡", "🔒", "🌍"][i]}</div>
              <h3 className="mt-3 font-medium">{t}</h3>
              <p className="mt-1 text-sm text-black/55">
                Served from the region closest to every visitor with automatic TLS.
              </p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-black/10 bg-white py-6 text-center text-xs text-black/40">
        Deployment {deployment.url_slug} · Hosted on Zale
      </footer>
    </div>
  );
}

function AgentConsole({ project, deployment }: { project: Project; deployment: Deployment }) {
  const fw = getFramework(project.framework);
  const since = deployment.finished_at ?? deployment.created_at;
  const uptimeMin = Math.max(1, Math.floor((Date.now() - since) / 60_000));
  const uptime =
    uptimeMin < 60
      ? `${uptimeMin}m`
      : uptimeMin < 60 * 24
        ? `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`
        : `${Math.floor(uptimeMin / 1440)}d ${Math.floor((uptimeMin % 1440) / 60)}h`;

  const tasks = [
    { t: "2m ago", msg: "task completed: summarize-inbox (4.2s, 12.3k tokens)" },
    { t: "9m ago", msg: "task completed: research-request #482 (18.7s, 51.0k tokens)" },
    { t: "17m ago", msg: "heartbeat ok — memory 312 MB, cpu 4%" },
    { t: "26m ago", msg: "task completed: draft-reply (2.1s, 3.4k tokens)" },
    { t: "38m ago", msg: "task queued from webhook: crm-sync" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-forest-edge bg-forest">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <span className="flex items-center gap-2.5 font-medium">
            <span aria-hidden>{fw.icon}</span> {project.name}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-success/40 px-3 py-1 text-xs text-success">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-success" /> ONLINE
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Uptime", uptime],
            ["Runtime", fw.name],
            ["Region", project.region],
            ["Version", deployment.commit_sha.slice(0, 7)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-edge bg-surface p-4">
              <dt className="text-xs text-fg-faint">{k}</dt>
              <dd className="mt-1 font-mono text-sm">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 overflow-hidden rounded-lg border border-edge bg-surface">
          <div className="border-b border-edge px-5 py-3 text-sm font-medium">Recent activity</div>
          <div className="px-5 py-4 font-mono text-[12.5px] leading-[1.9] text-fg-muted">
            {tasks.map((line) => (
              <div key={line.t} className="flex gap-4">
                <span className="w-16 shrink-0 select-none text-fg-faint">{line.t}</span>
                <span>{line.msg}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-fg-faint">
          Agent {deployment.url_slug} · always-on worker · Hosted on Zale
        </p>
      </main>
    </div>
  );
}

function StatusShell({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex items-center gap-5">
        <span className="text-4xl font-bold text-fg">{code}</span>
        <span className="h-12 w-px bg-edge-strong" />
        <div className="text-left">
          <h1 className="font-medium text-fg">{title}</h1>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">{children}</p>
        </div>
      </div>
      <p className="mt-12 text-xs text-fg-faint">{APP_DOMAIN}</p>
    </div>
  );
}
