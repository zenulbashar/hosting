import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProject } from "@/lib/data";
import { listActivity } from "@/lib/activity";
import { timeAgo } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  "project.created": "M12 5v14M5 12h14",
  "project.updated": "M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  "deployment.created": "M13 2L3 14h7l-1 8 11-13h-7l0.5-7z",
  "deployment.promoted": "M12 19V5M5 12l7-7 7 7",
  "deployment.failed": "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  "deployment.canceled": "M18 6L6 18M6 6l12 12",
  "domain.added": "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20",
  "domain.verified": "M5 13l4 4L19 7",
  "env.created": "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l5.9-5.9A6 6 0 1121 9z",
  "hook.created": "M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7",
  "hook.deleted": "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  "database.created": "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  "database.branch.created": "M6 3v12a3 3 0 003 3h6M6 3a2 2 0 100 4 2 2 0 000-4zm12 12a2 2 0 100 4 2 2 0 000-4zM6 7v0",
  "database.deleted": "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
};

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) notFound();

  const events = await listActivity(project.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Activity"
        description="Everything that happened to this project — deployments, domains, configuration."
      />
      {events.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Actions like deployments, domain changes and settings updates will show up here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-edge">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-4 px-6 py-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-background">
                  <svg
                    className={`h-4 w-4 ${e.type === "deployment.failed" ? "text-danger" : e.type === "deployment.promoted" ? "text-success" : "text-fg-muted"}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={TYPE_ICON[e.type] ?? "M12 8v4l3 3"} />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{e.message}</p>
                  <p className="mt-0.5 text-xs text-fg-faint">
                    by {e.actor} · {timeAgo(e.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}
