import { StatusDot } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
};

/** Every deployment status with its label. In-progress states pulse. */
export function AllStatuses() {
  return (
    <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 12 }}>
      <StatusDot status="QUEUED" />
      <StatusDot status="BUILDING" />
      <StatusDot status="DEPLOYING" />
      <StatusDot status="READY" />
      <StatusDot status="ERROR" />
      <StatusDot status="CANCELED" />
    </div>
  );
}

/** Dot-only form (withLabel=false) for compact rows. */
export function DotsOnly() {
  return (
    <div style={{ ...frame, display: "flex", gap: 16, alignItems: "center" }}>
      <StatusDot status="READY" withLabel={false} />
      <StatusDot status="BUILDING" withLabel={false} />
      <StatusDot status="ERROR" withLabel={false} />
      <StatusDot status="CANCELED" withLabel={false} />
    </div>
  );
}
