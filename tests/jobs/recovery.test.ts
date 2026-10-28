import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { isWorkflowDead, selectStuckRuns, STUCK_AFTER_MS } from "@/lib/jobs/recovery";

const now = new Date("2026-10-28T12:00:00Z");
const old = new Date(now.getTime() - STUCK_AFTER_MS - 60_000);
const fresh = new Date(now.getTime() - 5 * 60_000);

describe("selectStuckRuns", () => {
  const wf = new Map([
    ["wf-done", "succeeded"],
    ["wf-failed", "failed"],
    ["wf-queued", "queued"],
    ["wf-running", "running"],
  ]);
  it("selects old active runs whose workflow finished or is missing", () => {
    const runs = [
      { id: "a", status: "running", workflowRunId: "wf-failed", createdAt: old },
      { id: "b", status: "queued", workflowRunId: "wf-done", createdAt: old },
      { id: "c", status: "running", workflowRunId: "wf-gone", createdAt: old },
      { id: "d", status: "queued", workflowRunId: null, createdAt: old },
      { id: "e", status: "retry_scheduled", workflowRunId: "wf-failed", createdAt: old },
    ];
    expect(selectStuckRuns(runs, wf, now)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("leaves young runs, live workflows and finished runs alone", () => {
    const runs = [
      { id: "young", status: "running", workflowRunId: "wf-failed", createdAt: fresh },
      { id: "backlog", status: "queued", workflowRunId: "wf-queued", createdAt: old },
      { id: "live", status: "running", workflowRunId: "wf-running", createdAt: old },
      { id: "done", status: "succeeded", workflowRunId: "wf-gone", createdAt: old },
      { id: "failed", status: "failed", workflowRunId: null, createdAt: old },
    ];
    expect(selectStuckRuns(runs, wf, now)).toEqual([]);
  });
});

describe("isWorkflowDead", () => {
  it("is dead only when both lock and progress are stale", () => {
    expect(isWorkflowDead({ lockedAt: old, lastSignalAt: old, now })).toBe(true);
    expect(isWorkflowDead({ lockedAt: null, lastSignalAt: null, now })).toBe(true);
    expect(isWorkflowDead({ lockedAt: fresh, lastSignalAt: old, now })).toBe(false);
    expect(isWorkflowDead({ lockedAt: old, lastSignalAt: fresh, now })).toBe(false);
  });
});
