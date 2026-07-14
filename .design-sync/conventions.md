# Zale cloud UI — how to build with this system

Zale cloud is the design system for a developer hosting platform (a Vercel-style
product). It is **dark-themed by construction**: components use near-white ink
(`--color-fg` `#ededed`) on dark surfaces. They render invisibly on a white
page — so this rule is non-negotiable:

**Always render components on the dark surface.** Wrap any screen or section in a
container that sets the background and base ink, e.g.:

```jsx
<div style={{ background: "var(--color-background)", color: "var(--color-fg)",
              fontFamily: "var(--font-sans)", minHeight: "100vh" }}>
  {/* Zale cloud components go here */}
</div>
```

There is **no React provider to wrap** — the components are self-styled via a
shipped stylesheet; the only requirement is the dark background above.

## Styling idiom — props, not class names

Components carry their own styling. You configure them through **props**, never by
passing utility classes for their core look:

- `Button` / `ButtonLink`: `variant` = `primary` (solid light) | `accent` (brand
  blue) | `secondary` (outlined) | `ghost` | `danger`; `size` = `sm` | `md` | `lg`.
- `Badge`: `tone` = `default` | `success` | `warning` | `danger` | `accent`.
- `StatusDot`: `status` = `QUEUED` | `BUILDING` | `DEPLOYING` | `READY` | `ERROR` |
  `CANCELED`; `withLabel` toggles the text.
- `Input`, `Select`, `Label`: native form attributes (`placeholder`, `value`,
  `disabled`, `htmlFor`). Pair `Label` above `Input`/`Select`.
- `Card`: a surface panel — add padding with `className="p-6"` and compose your own
  header/body/footer inside.
- `EmptyState` (`title`, `description`, `action`) and `PageHeader` (`title`,
  `description`, `actions`) take content as props.
- `Spinner` (size/color via `className`), `Logo` / `LogoMark` (brand lockup + glyph).

A `className` prop IS accepted on most components for **spacing and layout only**
(e.g. `"p-6"`, `"mt-4"`) — not for recoloring.

## Design tokens (CSS variables, defined in the shipped stylesheet)

Use these for any layout glue you write, so it matches the system:

| Role | Variable | Value |
|---|---|---|
| Page background | `--color-background` | `#0a0a0a` |
| Panel surface | `--color-surface` | `#111112` |
| Hairline border | `--color-edge` / `--color-edge-strong` | `#232326` / `#333338` |
| Primary text | `--color-fg` | `#ededed` |
| Muted / faint text | `--color-fg-muted` / `--color-fg-faint` | `#a1a1aa` / `#63636b` |
| Brand blue | `--color-accent` | `#0070f3` |
| Forest (nav/header brand) | `--color-forest` | `#13301f` |
| Success / Warning / Danger | `--color-success` / `--color-warning` / `--color-danger` | `#45de8f` / `#f5a623` / `#f04444` |
| Sans / Mono font | `--font-sans` / `--font-mono` | system stacks |

The full stylesheet (every token + the compiled utility classes the components
use) is in `_ds/<folder>/styles.css` and the file it imports, `_ds_bundle.css` —
read those before styling. Per-component API and examples live in each
component's `.prompt.md`.

## One idiomatic example

```jsx
<div style={{ background: "var(--color-background)", color: "var(--color-fg)",
              fontFamily: "var(--font-sans)", padding: 32, minHeight: "100vh" }}>
  <PageHeader
    title="Deployments"
    description="Every deployment for this project, newest first."
    actions={<Button variant="accent" size="sm">New Deployment</Button>}
  />
  <Card className="p-6">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <strong>acme-storefront</strong>
      <Badge tone="accent">Production</Badge>
    </div>
    <div style={{ marginTop: 12 }}><StatusDot status="READY" /></div>
  </Card>
</div>
```
