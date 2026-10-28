// Standalone worker for production: run alongside `next start` with RUN_WORKER_IN_APP=false.
import { bootWorker } from "@/lib/jobs";

bootWorker();
console.log("[worker] started — polling workflow queue");
