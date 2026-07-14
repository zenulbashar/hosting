import { ButtonLink } from "zale-cloud-ui";

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

/** Anchor styled as a button, for navigation actions. Same variants as Button. */
export function Variants() {
  return (
    <div style={frame}>
      <ButtonLink href="#" variant="primary">
        Open Dashboard
      </ButtonLink>
      <ButtonLink href="#" variant="accent">
        New Project
      </ButtonLink>
      <ButtonLink href="#" variant="secondary">
        View Docs
      </ButtonLink>
    </div>
  );
}

/** The three sizes as links. */
export function Sizes() {
  return (
    <div style={frame}>
      <ButtonLink href="#" size="sm">
        Small
      </ButtonLink>
      <ButtonLink href="#" size="md">
        Medium
      </ButtonLink>
      <ButtonLink href="#" size="lg">
        Large
      </ButtonLink>
    </div>
  );
}
