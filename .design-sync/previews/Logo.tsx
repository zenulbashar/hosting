import { Logo } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
};

/** The full Zale cloud lockup — the diamond mark plus the wordmark. */
export function Default() {
  return (
    <div style={frame}>
      <Logo href="#" />
    </div>
  );
}
