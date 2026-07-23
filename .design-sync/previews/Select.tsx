import { Label, Select } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  maxWidth: 380,
};

/** A region picker — a labelled select with options. */
export function RegionPicker() {
  return (
    <div style={frame}>
      <Label htmlFor="region">Region</Label>
      <Select id="region" defaultValue="syd1">
        <option value="syd1">Sydney, Australia (syd1)</option>
        <option value="sin1">Singapore (sin1)</option>
        <option value="hnd1">Tokyo, Japan (hnd1)</option>
        <option value="iad1">Washington, D.C. (iad1)</option>
      </Select>
    </div>
  );
}

/** Disabled select. */
export function Disabled() {
  return (
    <div style={frame}>
      <Select defaultValue="22.x" disabled>
        <option value="22.x">Node.js 22.x</option>
      </Select>
    </div>
  );
}
