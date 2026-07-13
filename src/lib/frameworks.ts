export type FrameworkPreset = {
  id: string;
  name: string;
  buildCommand: string;
  outputDir: string;
  installCommand: string;
  devCommand: string;
  /** Small inline SVG glyph rendered in pickers and project cards. */
  icon: string;
  accent: string;
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
  },
];

export function getFramework(idOrName: string): FrameworkPreset {
  return (
    FRAMEWORKS.find((f) => f.id === idOrName || f.name === idOrName) ??
    FRAMEWORKS[FRAMEWORKS.length - 1]
  );
}
