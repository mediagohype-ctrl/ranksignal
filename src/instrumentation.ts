// Starts the in-process job worker for single-node deployments (set RUN_WORKER_IN_APP=false
// when running `npm run worker` separately). The NEXT_RUNTIME check must wrap the import so
// webpack can drop the Node-only worker graph from the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_WORKER_IN_APP !== "false") {
    const { bootWorker } = await import("./lib/jobs/boot-node");
    bootWorker();
  }
}
