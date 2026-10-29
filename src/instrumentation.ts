// Node-runtime boot: validate env, start the in-process job worker for single-node deployments (set
// RUN_WORKER_IN_APP=false when running `npm run worker` separately) and drain it gracefully on SIGTERM.
// The NEXT_RUNTIME check must wrap the imports so webpack can drop the Node-only graph from the edge bundle.
//
// SIGTERM: Next's own handler exits immediately, so set NEXT_MANUAL_SIG_HANDLE=true (render.yaml does) and
// we exit after draining. Render waits maxShutdownDelaySeconds before SIGKILL; keep it ≥ ~45s.
export async function register() {
  // Everything Node-only stays inside this block so the edge bundle drops it (NEXT_RUNTIME is inlined).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Throws in production on fatal misconfiguration (missing secrets, bad keys) so a broken deploy fails fast.
    const { assertProductionEnv } = await import("./lib/env");
    assertProductionEnv();

    if (process.env.RUN_WORKER_IN_APP !== "false") {
      const { bootWorker } = await import("./lib/jobs/boot-node");
      bootWorker();

      const g = globalThis as unknown as { __sigtermRegistered?: boolean };
      if (!g.__sigtermRegistered) {
        g.__sigtermRegistered = true;
        let shuttingDown = false;
        const onSignal = async (signal: string) => {
          if (shuttingDown) return;
          shuttingDown = true;
          const [{ shutdownWorker }, { log }, { db }] = await Promise.all([import("./lib/jobs/queue"), import("./lib/log"), import("./lib/db")]);
          log.info("process.signal", { signal });
          try {
            // Scans get 20s, then are released back to the queue; site writes finish or are marked needs_review.
            await shutdownWorker({ graceMs: 20_000, siteWriteGraceMs: 20_000 });
          } catch (err) {
            log.error("process.shutdown_failed", { err });
          }
          await db.$disconnect().catch(() => undefined);
          // With NEXT_MANUAL_SIG_HANDLE Next leaves exiting to us; otherwise Next's handler exits on its own.
          if (process.env.NEXT_MANUAL_SIG_HANDLE === "true") process.exit(0);
        };
        process.on("SIGTERM", () => void onSignal("SIGTERM"));
        process.on("SIGINT", () => void onSignal("SIGINT"));
      }
    }
  }
}
