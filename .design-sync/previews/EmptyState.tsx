import { Button, EmptyState } from "zale-cloud-ui";

const frame = {
  background: "#0a0a0a",
  color: "#ededed",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  padding: 24,
  maxWidth: 520,
};

/** A zero-state with title and description. */
export function Default() {
  return (
    <div style={frame}>
      <EmptyState
        title="No deployments yet"
        description="Push to your connected repository to trigger the first build."
      />
    </div>
  );
}

/** A zero-state with a call-to-action button. */
export function WithAction() {
  return (
    <div style={frame}>
      <EmptyState
        title="Deploy your first project"
        description="Import a git repository and Zale cloud will build and deploy it to Sydney in seconds."
        action={<Button>Import Project</Button>}
      />
    </div>
  );
}
