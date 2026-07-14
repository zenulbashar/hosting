import { Badge, Card, StatusDot } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  maxWidth: 420,
};

/** A simple content card with padding via className. */
export function Basic() {
  return (
    <div style={frame}>
      <Card className="p-6">
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Production Deployment</h3>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#a1a1aa" }}>
          Deployed 4 minutes ago from <span style={{ fontFamily: "ui-monospace, monospace" }}>main</span>
        </p>
      </Card>
    </div>
  );
}

/** A card composing a header row with status and a body — the common panel layout. */
export function WithHeader() {
  return (
    <div style={frame}>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #232326",
          }}
        >
          <strong style={{ fontSize: 14 }}>acme-storefront</strong>
          <Badge tone="accent">Production</Badge>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <StatusDot status="READY" />
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#a1a1aa" }}>
            acme-storefront.zale.app
          </p>
        </div>
      </Card>
    </div>
  );
}
