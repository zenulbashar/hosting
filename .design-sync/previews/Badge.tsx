import { Badge } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
  alignItems: "center",
};

/** All five tones, each carrying a typical hosting label. */
export function Tones() {
  return (
    <div style={frame}>
      <Badge>Preview</Badge>
      <Badge tone="accent">Production</Badge>
      <Badge tone="success">Ready</Badge>
      <Badge tone="warning">Building</Badge>
      <Badge tone="danger">Error</Badge>
    </div>
  );
}
