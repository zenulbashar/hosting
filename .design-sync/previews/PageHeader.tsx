import { Button, PageHeader } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  maxWidth: 720,
};

/** A page heading with a title and description. */
export function Default() {
  return (
    <div style={frame}>
      <PageHeader
        title="Deployments"
        description="Every deployment for this project, newest first."
      />
    </div>
  );
}

/** A heading with right-aligned action buttons. */
export function WithActions() {
  return (
    <div style={frame}>
      <PageHeader
        title="Domains"
        description="Custom domains served from the edge with automatic TLS."
        actions={
          <>
            <Button variant="secondary" size="sm">
              Refresh
            </Button>
            <Button size="sm">Add Domain</Button>
          </>
        }
      />
    </div>
  );
}
