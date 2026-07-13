"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [framework, setFramework] = useState("nextjs");
  const [showBuildSettings, setShowBuildSettings] = useState(false);
  const [rootDir, setRootDir] = useState("./");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fw = getFramework(framework);

  function onRepoChange(value: string) {
    setRepoUrl(value);
    // Suggest a project name from the repo path, unless the user typed one.
    if (!name || name === suggestName(repoUrl)) {
      setName(suggestName(value));
    }
  }

  function suggestName(url: string): string {
    const last = url.replace(/\.git$/, "").split("/").filter(Boolean).pop() ?? "";
    return last.replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        repo_url: repoUrl,
        framework,
        root_dir: rootDir,
        build_command: buildCommand,
        output_dir: outputDir,
        install_command: installCommand,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create project");
      setPending(false);
      return;
    }
    // Jump straight to the first deployment so the user can watch the build.
    router.push(`/projects/${data.project.id}/deployments/${data.deployment.id}`);
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="p-6">
        <div className="space-y-5">
          <div>
            <Label htmlFor="repo">Git repository URL</Label>
            <Input
              id="repo"
              value={repoUrl}
              onChange={(e) => onRepoChange(e.target.value)}
              placeholder="https://github.com/acme/my-app"
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
              required
              maxLength={100}
            />
          </div>

          <div>
            <Label>Framework preset</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFramework(f.id)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    framework === f.id
                      ? "border-fg bg-surface-hover"
                      : "border-edge-strong hover:border-fg-faint"
                  }`}
                >
                  <span aria-hidden>{f.icon}</span>
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-edge-strong">
            <button
              type="button"
              onClick={() => setShowBuildSettings((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface-hover"
            >
              Build and Output Settings
              <svg
                className={`h-4 w-4 text-fg-muted transition-transform ${showBuildSettings ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showBuildSettings && (
              <div className="space-y-4 border-t border-edge-strong p-4">
                <div>
                  <Label htmlFor="rootDir">Root directory</Label>
                  <Input
                    id="rootDir"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                    placeholder="./"
                  />
                </div>
                <div>
                  <Label htmlFor="buildCmd">Build command</Label>
                  <Input
                    id="buildCmd"
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder={fw.buildCommand || "None"}
                  />
                </div>
                <div>
                  <Label htmlFor="outputDir">Output directory</Label>
                  <Input
                    id="outputDir"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder={fw.outputDir}
                  />
                </div>
                <div>
                  <Label htmlFor="installCmd">Install command</Label>
                  <Input
                    id="installCmd"
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder={fw.installCommand || "None"}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Spinner className="text-background" /> : "Deploy"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
