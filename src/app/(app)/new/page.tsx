import type { Metadata } from "next";
import { NewProjectForm } from "@/components/new-project-form";

export const metadata: Metadata = { title: "New Project" };

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s build something new.</h1>
      <p className="mt-2 text-sm text-fg-muted">
        To deploy a new project, import an existing git repository. Nimbus will
        detect your framework, run the build, and put the result on the edge.
      </p>
      <div className="mt-8">
        <NewProjectForm />
      </div>
    </main>
  );
}
