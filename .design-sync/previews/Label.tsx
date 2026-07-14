import { Input, Label } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  maxWidth: 380,
};

/** A label bound to an input — the standard labelled field composition. */
export function WithInput() {
  return (
    <div style={frame}>
      <Label htmlFor="repo">Git repository URL</Label>
      <Input id="repo" placeholder="https://github.com/acme/app" />
    </div>
  );
}
