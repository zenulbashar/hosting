import { Button, Spinner } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  display: "flex",
  gap: 20,
  alignItems: "center",
};

/** The default 16px spinner. */
export function Default() {
  return (
    <div style={frame}>
      <Spinner />
    </div>
  );
}

/** Recolored and resized via className. */
export function Sizes() {
  return (
    <div style={frame}>
      <Spinner className="h-4 w-4 text-fg-muted" />
      <Spinner className="h-6 w-6 text-fg" />
      <Spinner className="h-8 w-8 text-accent" />
    </div>
  );
}

/** A spinner inside a disabled button — the loading action pattern. */
export function InButton() {
  return (
    <div style={frame}>
      <Button disabled>
        <Spinner className="h-4 w-4 text-background" />
      </Button>
    </div>
  );
}
