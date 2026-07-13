export type FrameworkPreset = {
  id: string;
  name: string;
  buildCommand: string;
  outputDir: string;
  installCommand: string;
  devCommand: string;
  /** Small glyph rendered in pickers and project cards. */
  icon: string;
  accent: string;
  /**
   * 'site' deploys build outputs to the edge; 'agent' additionally runs an
   * always-on worker process (the runtime AI agents need).
   */
  kind: "site" | "agent";
};

export const FRAMEWORKS: FrameworkPreset[] = [
  {
    id: "nextjs",
    name: "Next.js",
    buildCommand: "next build",
    outputDir: ".next",
    installCommand: "npm install",
    devCommand: "next dev",
    icon: "▲",
    accent: "#ffffff",
    kind: "site",
  },
  {
    id: "vite",
    name: "Vite",
    buildCommand: "vite build",
    outputDir: "dist",
    installCommand: "npm install",
    devCommand: "vite",
    icon: "⚡",
    accent: "#a78bfa",
    kind: "site",
  },
  {
    id: "astro",
    name: "Astro",
    buildCommand: "astro build",
    outputDir: "dist",
    installCommand: "npm install",
    devCommand: "astro dev",
    icon: "🚀",
    accent: "#fb7185",
    kind: "site",
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    buildCommand: "vite build",
    outputDir: ".svelte-kit",
    installCommand: "npm install",
    devCommand: "vite dev",
    icon: "🔥",
    accent: "#fb923c",
    kind: "site",
  },
  {
    id: "remix",
    name: "Remix",
    buildCommand: "remix vite:build",
    outputDir: "build",
    installCommand: "npm install",
    devCommand: "remix vite:dev",
    icon: "💿",
    accent: "#60a5fa",
    kind: "site",
  },
  {
    id: "nuxt",
    name: "Nuxt",
    buildCommand: "nuxt build",
    outputDir: ".output",
    installCommand: "npm install",
    devCommand: "nuxt dev",
    icon: "🟢",
    accent: "#4ade80",
    kind: "site",
  },
  {
    id: "static",
    name: "Static HTML",
    buildCommand: "",
    outputDir: "./",
    installCommand: "",
    devCommand: "",
    icon: "📄",
    accent: "#a1a1aa",
    kind: "site",
  },
  {
    id: "claude-agent",
    name: "Claude Agent SDK",
    buildCommand: "npm run build",
    outputDir: "dist",
    installCommand: "npm install",
    devCommand: "npm run dev",
    icon: "🤖",
    accent: "#d97757",
    kind: "agent",
  },
  {
    id: "langgraph",
    name: "LangGraph (Python)",
    buildCommand: "",
    outputDir: "./",
    installCommand: "pip install -r requirements.txt",
    devCommand: "langgraph dev",
    icon: "🧠",
    accent: "#34d399",
    kind: "agent",
  },
  {
    id: "fastapi",
    name: "FastAPI Service",
    buildCommand: "",
    outputDir: "./",
    installCommand: "pip install -r requirements.txt",
    devCommand: "uvicorn main:app --reload",
    icon: "🐍",
    accent: "#0ea5e9",
    kind: "agent",
  },
];

export function getFramework(idOrName: string): FrameworkPreset {
  return (
    FRAMEWORKS.find((f) => f.id === idOrName || f.name === idOrName) ??
    FRAMEWORKS[FRAMEWORKS.length - 1]
  );
}
