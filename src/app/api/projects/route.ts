import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjectsWithLatestDeployment } from "@/lib/data";
import { createDeployment } from "@/lib/deploy-engine";
import { getFramework } from "@/lib/frameworks";
import { badRequest, json, unauthorized } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ projects: listProjectsWithLatestDeployment(user.id) });
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

  const project = createProject(user.id, {
    name,
    repo_url: repoUrl,
    framework: framework.id,
    root_dir: typeof body?.root_dir === "string" ? body.root_dir : "./",
    build_command: typeof body?.build_command === "string" && body.build_command ? body.build_command : null,
    output_dir: typeof body?.output_dir === "string" && body.output_dir ? body.output_dir : null,
    install_command: typeof body?.install_command === "string" && body.install_command ? body.install_command : null,
  });

  // Kick off the first production deployment immediately, like a fresh import.
  const deployment = createDeployment(project, {
    environment: "production",
    commitMsg: "Initial deployment",
  });

  return json({ project, deployment }, 201);
}
