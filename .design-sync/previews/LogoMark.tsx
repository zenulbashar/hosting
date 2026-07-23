import { LogoMark } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  display: "flex",
  gap: 20,
  alignItems: "center",
};

/** The diamond glyph at its default size. It inherits color from `currentColor`. */
export function Default() {
  return (
    <div style={frame}>
      <LogoMark />
    </div>
  );
}

/** The mark at several sizes, and tinted with the brand blue via color. */
export function Sizes() {
  return (
    <div style={frame}>
      <LogoMark size={20} />
      <LogoMark size={32} />
      <span style={{ color: "#0070f3", display: "inline-flex" }}>
        <LogoMark size={44} />
      </span>
    </div>
  );
}
