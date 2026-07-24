"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/data";
import { FRAMEWORKS } from "@/lib/frameworks";
import { REGIONS } from "@/lib/regions";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <h2 className="text-base font-medium">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <div className="flex items-center justify-end border-t border-edge bg-background/50 px-6 py-3.5">
        {footer}
      </div>
    </Card>
  );
}

export function ProjectSettings({
  project,
  canAdminister = true,
}: {
  project: Project;
  canAdminister?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [framework, setFramework] = useState(project.framework);
  const [rootDir, setRootDir] = useState(project.root_dir);
  const [buildCommand, setBuildCommand] = useState(project.build_command ?? "");
  const [outputDir, setOutputDir] = useState(project.output_dir ?? "");
  const [installCommand, setInstallCommand] = useState(project.install_command ?? "");
  const [nodeVersion, setNodeVersion] = useState(project.node_version);
  const [region, setRegion] = useState(project.region);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ section: string; msg: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function save(section: string, patch: Record<string, unknown>) {
    setSaving(section);
    setSaved(null);
    setSaveError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(null);
    if (res.ok) {
      setSaved(section);
      router.refresh();
      setTimeout(() => setSaved(null), 2500);
    } else {
      setSaveError({ section, msg: data.error ?? "Could not save changes. Please try again." });
    }
  }

  async function destroy() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Project Name"
        description="Used in the dashboard and as the base of your default subdomain."
        footer={
          <div className="flex items-center gap-3">
            {saved === "name" && <span className="text-[13px] text-success">Saved</span>}
            {saveError?.section === "name" && <span className="text-[13px] text-danger">{saveError.msg}</span>}
            <Button size="sm" onClick={() => save("name", { name })} disabled={saving === "name" || !name.trim()}>
              {saving === "name" ? <Spinner className="text-background" /> : "Save"}
            </Button>
          </div>
        }
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" maxLength={100} />
      </SettingsCard>

      <SettingsCard
        title="Build & Development Settings"
        description="Override the framework preset when your project needs custom commands."
        footer={
          <div className="flex items-center gap-3">
            {saved === "build" && <span className="text-[13px] text-success">Saved</span>}
            {saveError?.section === "build" && <span className="text-[13px] text-danger">{saveError.msg}</span>}
            <Button
              size="sm"
              onClick={() =>
                save("build", {
                  framework,
                  root_dir: rootDir,
                  build_command: buildCommand,
                  output_dir: outputDir,
                  install_command: installCommand,
                  node_version: nodeVersion,
                  region,
                })
              }
              disabled={saving === "build"}
            >
              {saving === "build" ? <Spinner className="text-background" /> : "Save"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Framework preset</Label>
            <Select value={framework} onChange={(e) => setFramework(e.target.value)}>
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Node.js version</Label>
            <Select value={nodeVersion} onChange={(e) => setNodeVersion(e.target.value)}>
              {["22.x", "20.x", "18.x"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Region</Label>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.available}>
                  {r.flag} {r.city}, {r.country} ({r.id}){!r.available ? " — coming soon" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Root directory</Label>
            <Input value={rootDir} onChange={(e) => setRootDir(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Install command</Label>
            <Input
              value={installCommand}
              onChange={(e) => setInstallCommand(e.target.value)}
              placeholder="npm install"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Build command</Label>
            <Input
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="Framework default"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Output directory</Label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="Framework default"
              className="font-mono"
            />
          </div>
        </div>
      </SettingsCard>

      {canAdminister ? (
        <Card className="overflow-hidden border-danger/40">
          <div className="p-6">
            <h2 className="text-base font-medium text-danger">Delete Project</h2>
            <p className="mt-1 max-w-lg text-[13px] text-fg-muted">
              The project, all of its deployments, domains and environment
              variables will be permanently removed. This action cannot be undone.
            </p>
            <div className="mt-5 max-w-sm">
              <Label htmlFor="confirm">
                Type <span className="font-mono text-fg">{project.name}</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={project.name}
              />
            </div>
          </div>
          <div className="flex items-center justify-end border-t border-danger/30 bg-danger/5 px-6 py-3.5">
            <Button
              variant="danger"
              size="sm"
              onClick={destroy}
              disabled={confirmName !== project.name || deleting}
            >
              {deleting ? <Spinner /> : "Delete Project"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="text-base font-medium">Delete Project</h2>
          <p className="mt-1 max-w-lg text-[13px] text-fg-muted">
            Only a team owner can delete this shared project.
          </p>
        </Card>
      )}
    </div>
  );
}
