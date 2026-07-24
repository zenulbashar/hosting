/**
 * Next.js boot hook. Runs once when the server process starts.
 *
 * Starting the deploy reconciler here means a process restart resumes any
 * in-flight builds immediately — no incoming request needed to wake them.
 * Guarded to the Node.js runtime so it never runs on the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReconciler } = await import("@/lib/deploy-engine");
    startReconciler();
    // Register the edge regions as operational (idempotent).
    const { seedRegionHealth } = await import("@/lib/region-health");
    await seedRegionHealth();
  }
}
