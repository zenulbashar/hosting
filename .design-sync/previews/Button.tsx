import { Button } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  alignItems: "center",
};

/** Every button variant, from the solid primary action to the destructive danger style. */
export function Variants() {
  return (
    <div style={frame}>
      <Button variant="primary">Deploy</Button>
      <Button variant="accent">Connect Git</Button>
      <Button variant="secondary">Redeploy</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="danger">Delete Project</Button>
    </div>
  );
}

/** The three sizes. */
export function Sizes() {
  return (
    <div style={frame}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

/** Disabled state dims to 50% and blocks pointer events. */
export function Disabled() {
  return (
    <div style={frame}>
      <Button disabled>Deploying…</Button>
      <Button variant="secondary" disabled>
        Redeploy
      </Button>
    </div>
  );
}
