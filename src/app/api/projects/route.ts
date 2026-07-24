import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjectsWithLatestDeployment } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { getFramework } from "@/lib/frameworks";
import { DEFAULT_REGION, REGIONS } from "@/lib/regions";
import { recordActivity } from "@/lib/activity";
import { isTeamMember } from "@/lib/teams";
import { checkProjectQuota } from "@/lib/quota";
import { badRequest, json, paymentRequired, unauthorized } from "@/lib/api";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const scopeParam = new URL(req.url).searchParams.get("scope");
  const scope =
    scopeParam && scopeParam !== "personal" && await isTeamMember(user.id, scopeParam)
      ? ({ type: "team", teamId: scopeParam } as const)
      : ({ type: "personal" } as const);
  return json({ projects: await listProjectsWithLatestDeployment(user.id, scope) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const repoUrl = typeof body?.repo_url === "string" ? body.repo_url.trim() : "";
  const framework = getFramework(typeof body?.framework === "string" ? body.framework : "static");

  if (name.length < 1 || name.length > 100) return badRequest("Project name is required");
  if (repoUrl.length < 3) return badRequest("Repository URL is required");

  const region = REGIONS.find((r) => r.id === body?.region && r.available)?.id ?? DEFAULT_REGION;

  let teamId: string | null = null;
  if (typeof body?.team_id === "string" && body.team_id) {
    if (!await isTeamMember(user.id, body.team_id)) return badRequest("You are not a member of that team");
    teamId = body.team_id;
  }

  // Enforce the personal project quota (team projects are billed to the team).
  if (!teamId) {
    const quota = await checkProjectQuota(user.id);
    if (!quota.ok) return paymentRequired(quota.message!, { quota });
  }

  const project = await createProject(user.id, {
    name,
    repo_url: repoUrl,
    framework: framework.id,
    root_dir: typeof body?.root_dir === "string" ? body.root_dir : "./",
    build_command: typeof body?.build_command === "string" && body.build_command ? body.build_command : null,
    output_dir: typeof body?.output_dir === "string" && body.output_dir ? body.output_dir : null,
    install_command: typeof body?.install_command === "string" && body.install_command ? body.install_command : null,
    region,
    team_id: teamId,
  });

  await recordActivity(project.id, user.name, "project.created", `Project imported from ${project.repo_url}`);

  // Kick off the first production deployment immediately, like a fresh import.
  const deployment = await createDeployment(project, {
    environment: "production",
    commitMsg: "Initial deployment",
  });
  await recordActivity(project.id, user.name, "deployment.created", `Deployment ${deployment.url_slug} created`);

  return json({ project, deployment }, 201);
}
