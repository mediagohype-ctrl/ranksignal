import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { where: Record<string, unknown>; data: Record<string, unknown> };
const h = vi.hoisted(() => ({
  claimRows: [] as Record<string, unknown>[],
  updateManyCount: 1,
  updateManyCalls: [] as Call[],
  events: [] as string[],
  notifications: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: async () => {
      const r = h.claimRows.shift();
      return r ? [r] : [];
    },
    workflowRun: {
      updateMany: async (a: Call) => {
        h.updateManyCalls.push(a);
        return { count: h.updateManyCount };
      },
      findMany: async () => [],
    },
    workflowEvent: { create: async (a: { data: { name: string } }) => void h.events.push(a.data.name) },
    membership: { findMany: async () => [{ userId: "staff1", organizationId: "agency" }] },
    notification: { createMany: async (a: { data: unknown[] }) => void h.notifications.push(...a.data) },
  },
}));

import {
  __resetQueueForTests, __runOnceForTests, claimSql, isClaimable, LOCK_TIMEOUT_MS, LostOwnershipError, NEEDS_REVIEW,
  nextPollDelay, registerHandler, shutdownWorker, tick, WORKER_ID,
} from "@/lib/jobs/queue";

const now = new Date("2026-10-29T12:00:00Z");
const stale = new Date(now.getTime() - LOCK_TIMEOUT_MS - 1000);
const fresh = new Date(now.getTime() - 1000);

function runRow(kind: string, extra: Record<string, unknown> = {}) {
  return {
    id: `run-${kind}`, kind, organizationId: "o1", projectId: "p1", state: "running", input: {}, attempts: 1, maxAttempts: 3,
    runAfter: now, lockedAt: now, lockedBy: WORKER_ID, ...extra,
  };
}

beforeEach(() => {
  __resetQueueForTests();
  h.claimRows = [];
  h.updateManyCount = 1;
  h.updateManyCalls = [];
  h.events = [];
  h.notifications = [];
});

describe("claim eligibility", () => {
  it("never reclaims abandoned execute_action / rollback runs", () => {
    for (const kind of ["execute_action", "rollback"]) {
      for (const state of ["running", "executing", "validating", "rollback_pending"]) {
        expect(isClaimable({ kind, state, runAfter: now, lockedAt: stale }, now)).toBe(false);
      }
    }
  });
  it("reclaims abandoned scans and claims due queued runs of any kind", () => {
    expect(isClaimable({ kind: "crawl", state: "running", runAfter: now, lockedAt: stale }, now)).toBe(true);
    expect(isClaimable({ kind: "crawl", state: "running", runAfter: now, lockedAt: fresh }, now)).toBe(false);
    expect(isClaimable({ kind: "execute_action", state: "queued", runAfter: now, lockedAt: null }, now)).toBe(true);
    expect(isClaimable({ kind: "execute_action", state: "retry_scheduled", runAfter: new Date(now.getTime() + 1000), lockedAt: null }, now)).toBe(false);
  });
  it("claims with one statement using SKIP LOCKED and excludes site-write kinds from reclaim", () => {
    const q = claimSql(now);
    expect(q.sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(q.sql).toMatch(/RETURNING \*/);
    expect(q.sql).toMatch(/"kind" NOT IN/);
    expect(q.values).toEqual(expect.arrayContaining(["execute_action", "rollback", WORKER_ID]));
  });
});

describe("fencing", () => {
  it("stops writing when ownership is lost (count = 0)", async () => {
    h.claimRows.push(runRow("crawl"));
    let reachedAfterTransition = false;
    registerHandler("crawl", async (ctx) => {
      h.updateManyCount = 0; // another worker took the run over
      await ctx.transition("running", "crawl.step");
      reachedAfterTransition = true;
    });
    await __runOnceForTests();
    expect(reachedAfterTransition).toBe(false);
    // Only the fenced transition attempt; no failed/retry write afterwards.
    expect(h.updateManyCalls).toHaveLength(1);
    expect(h.updateManyCalls[0].where).toMatchObject({ id: "run-crawl", lockedBy: WORKER_ID });
    expect(h.events).not.toContain("crawl.failed");
    expect(h.events).not.toContain("crawl.retry_scheduled");
    expect(new LostOwnershipError("x")).toBeInstanceOf(Error);
  });

  it("every final write is fenced on lockedBy", async () => {
    h.claimRows.push(runRow("analyze"));
    registerHandler("analyze", async () => ({ ok: true }));
    await __runOnceForTests();
    expect(h.updateManyCalls.at(-1)).toMatchObject({ where: { id: "run-analyze", lockedBy: WORKER_ID }, data: { state: "succeeded", lockedBy: null } });
  });

  it("a site-write flagged needs_review is failed, not retried, and staff are notified", async () => {
    h.claimRows.push(runRow("execute_action"));
    registerHandler("execute_action", async () => {
      throw Object.assign(new Error("could not verify"), { errorClass: NEEDS_REVIEW });
    });
    await __runOnceForTests();
    const last = h.updateManyCalls.at(-1)!;
    expect(last.where).toMatchObject({ lockedBy: WORKER_ID });
    expect(last.data).toMatchObject({ state: "failed", errorClass: NEEDS_REVIEW });
    expect(h.updateManyCalls.some((c) => c.data.state === "retry_scheduled")).toBe(false);
    expect(h.notifications).toHaveLength(1);
  });
});

describe("graceful shutdown", () => {
  it("releases in-flight scans (attempt not burned) but never releases site writes", async () => {
    h.claimRows.push(runRow("crawl"), runRow("execute_action"));
    registerHandler("crawl", () => new Promise(() => {}));
    registerHandler("execute_action", () => new Promise(() => {}));
    await tick();
    await shutdownWorker({ graceMs: 5, siteWriteGraceMs: 5 });
    const crawl = h.updateManyCalls.find((c) => c.where.id === "run-crawl")!;
    expect(crawl.where).toMatchObject({ lockedBy: WORKER_ID });
    expect(crawl.data).toMatchObject({ state: "retry_scheduled", lockedAt: null, attempts: { decrement: 1 } });
    const exec = h.updateManyCalls.filter((c) => c.where.id === "run-execute_action");
    expect(exec.some((c) => c.data.state === "retry_scheduled")).toBe(false);
    expect(exec.at(-1)!.data).toMatchObject({ state: "failed", errorClass: NEEDS_REVIEW });
  });
});

describe("idle backoff", () => {
  it("polls every second while busy and backs off to 30s when idle", () => {
    expect(nextPollDelay(16_000, true)).toBe(1_000);
    expect(nextPollDelay(1_000, false)).toBe(2_000);
    expect(nextPollDelay(20_000, false)).toBe(30_000);
  });
});
