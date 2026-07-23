# Zale cloud — design-sync notes

This repo is a **Next.js application**, not a published component library. The
design system synced to claude.ai/design is a **curated, Next-free extraction**
of the presentational primitives from `src/components/ui.tsx` + `logo.tsx`.

## How the synced package is produced (IMPORTANT for re-sync)

- The DS package is **synthesized in a scratch dir**, not committed:
  `…/scratchpad/zale-ds/` with `src/index.tsx` (adapted primitives),
  `build.sh` (esbuild → `dist/index.js`, tsc → `dist/index.d.ts`,
  `@tailwindcss/cli` → `dist/zale.css`).
- Adaptations vs. the app source: `ButtonLink` and `Logo` render plain `<a>`
  instead of `next/link`; the `Logo` wordmark says **"Zale cloud"**; the
  `DeploymentStatus` type is inlined (app imports it from `@/lib/data`).
- Converter run (from repo root):
  `node .ds-sync/package-build.mjs --config .design-sync/config.json \
   --node-modules <zale-ds>/node_modules --entry <zale-ds>/dist/index.js --out ./ds-bundle`
- Render check + capture need chromium. It is pre-installed at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; export
  `DS_CHROMIUM_PATH=<that path>` before `package-validate.mjs` /
  `package-capture.mjs` (the pinned `playwright` build 1228 doesn't match the
  installed 1194 browser, so the executablePath override is required).

## Accepted warnings (known, not new)

- `[FONT_MISSING] "Inter"` — the `--font-sans` token is a system stack that
  merely *names* Inter as one option; the app never shipped an Inter webfont
  either. Accepted: the DS pane renders in the system fallback (system-ui /
  -apple-system), which is exactly what the app shows. Do NOT treat this as new.

## Known render warns
- (none currently — all 13 components render clean at full size.)

## Re-sync risks (watch-list)
- **The synthesized package lives in scratch and is NOT committed**, so a fresh
  clone cannot rebuild it. To make re-sync reproducible, move the `zale-ds/`
  package source into the repo (e.g. `.design-sync/pkg/`) and update
  `--entry`/`--node-modules` paths. Until then, re-sync requires re-creating the
  scratch package from this file + `src/components/ui.tsx`.
- The DS is a **manual extraction** of `ui.tsx`. If `ui.tsx` changes (new
  primitive, changed variant), the extraction in `zale-ds/src/index.tsx` must be
  updated by hand — it does not track the app automatically.
- Dark-surface convention: every preview wraps content in an inline dark frame
  because claude.ai/design cards render on white. The conventions header tells
  the design agent the same. If cards ever look blank, this is why.
