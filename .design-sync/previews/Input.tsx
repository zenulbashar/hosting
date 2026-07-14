import { Input } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  maxWidth: 380,
};

/** A text field with placeholder text. */
export function Default() {
  return (
    <div style={frame}>
      <Input placeholder="my-project" />
    </div>
  );
}

/** A field with a value already entered. */
export function WithValue() {
  return (
    <div style={frame}>
      <Input defaultValue="acme-storefront" />
    </div>
  );
}

/** Disabled and read-only states. */
export function Disabled() {
  return (
    <div style={frame}>
      <Input placeholder="Cannot edit" disabled />
    </div>
  );
}
