import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  org: { planId: "trial", status: "active", createdAt: new Date() } as { planId: string; status: string; createdAt: Date },
  visibilityRunsThisMonth: 0,
  lastCrawlAt: null as Date | null,
  activeCrawl: false,
  promptCount: 5,
  enqueued: [] as { kind: string; input: Record<string, unknown> }[],
  visibilityCountWhere: null as unknown,
}));

vi.mock("@/lib/db", () => {
  const db = {
    organization: { findUnique: vi.fn(async () => state.org) },
    subscription: { findMany: vi.fn(async () => []) },
    visibilityRun: {
      count: vi.fn(async (args: { where: unknown }) => {
        state.visibilityCountWhere = args.where;
        return state.visibilityRunsThisMonth;
      }),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "vr_1", ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "vr_1", ...data })),
    },
    crawlRun: {
      findFirst: vi.fn(async (args: { where: { status?: unknown; createdAt?: { gt?: Date } } }) => {
        if (args.where.status) return state.activeCrawl ? { id: "cr_active", status: "running" } : null; // in-progress check
        const since = args.where.createdAt?.gt;
        return state.lastCrawlAt && since && state.lastCrawlAt > since ? { createdAt: state.lastCrawlAt } : null;
      }),
      create: vi.fn(async () => ({ id: "cr_1" })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "cr_1", ...data })),
    },
    trackedPrompt: { count: vi.fn(async () => state.promptCount) },
    usageLedger: { groupBy: vi.fn(async () => []), create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db };
});

vi.mock("@/lib/api", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...orig,
    requireSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org_1", role: "member" })),
    requireProject: vi.fn(async () => ({ id: "p1", organizationId: "org_1" })),
  };
});
vi.mock("@/lib/jobs/queue", () => ({
  enqueue: vi.fn(async (o: { kind: string; input: Record<string, unknown> }) => {
    state.enqueued.push(o);
    return { id: "wf_1" };
  }),
}));
vi.mock("@/lib/prompts/service", () => ({ currentPromptSetVersion: vi.fn(async () => 1) }));

import { POST as postVisibility } from "@/app/api/projects/[id]/visibility-runs/route";
import { POST as postCrawl } from "@/app/api/projects/[id]/crawl-runs/route";
import { crawlRetryAfterSec, CRAWL_MIN_INTERVAL_MS, getRunPromptCap, getVisibilityRunAllowance } from "@/lib/billing/ai-limits";
import { PLANS } from "@/lib/billing/plans";
import { reserveCredits } from "@/lib/billing/usage";
import { JobError } from "@/lib/types";

const ctx = { params: Promise.resolve({ id: "p1" }) };
const req = (body = "") => new Request("http://localhost/api/projects/p1/x", { method: "POST", body });

beforeEach(() => {
  state.org = { planId: "trial", status: "active", createdAt: new Date() };
  state.visibilityRunsThisMonth = 0;
  state.lastCrawlAt = null;
  state.activeCrawl = false;
  state.promptCount = 5;
  state.enqueued = [];
});

describe("plan AI limits", () => {
  it("has the placeholder per-plan values", () => {
    expect([PLANS.trial, PLANS.starter, PLANS.growth, PLANS.agency].map((p) => [p.maxVisibilityRunsPerMonth, p.maxPromptsPerRun])).toEqual([
      [2, 10],
      [4, 25],
      [12, 60],
      [40, 150],
    ]);
  });
  it("prompt cap per run follows the plan", async () => {
    expect(await getRunPromptCap("org_1")).toBe(10);
    state.org.planId = "agency";
    expect(await getRunPromptCap("org_1")).toBe(150);
  });
  it("counts this month's runs, excluding failed runs with no answers", async () => {
    state.visibilityRunsThisMonth = 1;
    const a = await getVisibilityRunAllowance("org_1", new Date("2026-10-28T00:00:00Z"));
    expect(a).toMatchObject({ used: 1, limit: 2, remaining: 1 });
    expect(state.visibilityCountWhere).toMatchObject({
      organizationId: "org_1",
      createdAt: { gte: new Date("2026-10-01T00:00:00Z") },
      NOT: { status: { in: ["failed", "cancelled"] }, collected: 0 },
    });
  });
});

describe("POST visibility-runs", () => {
  it("creates a run and passes the prompt cap to the job", async () => {
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(201);
    expect(state.enqueued[0]).toMatchObject({ kind: "visibility", input: { maxPrompts: 10 } });
  });
  it("402 plan_limit when the monthly allowance is used", async () => {
    state.visibilityRunsThisMonth = 2;
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe("plan_limit");
    expect(state.enqueued).toHaveLength(0);
  });
  it("402 plan_inactive when the trial has expired", async () => {
    state.org.createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("plan_inactive");
    expect(body.error.details.upgradeUrl).toBeTruthy();
  });
});

describe("POST crawl-runs rate limit", () => {
  it("allows the first crawl", async () => {
    const res = await postCrawl(req(), ctx);
    expect(res.status).toBe(201);
  });
  it("409 with Retry-After within 10 minutes of the last crawl", async () => {
    state.lastCrawlAt = new Date(Date.now() - 4 * 60 * 1000);
    const res = await postCrawl(req(), ctx);
    expect(res.status).toBe(409);
    const retry = Number(res.headers.get("retry-after"));
    expect(retry).toBeGreaterThan(5 * 60);
    expect(retry).toBeLessThanOrEqual(6 * 60);
    const body = await res.json();
    expect(body.error.code).toBe("crawl_rate_limited");
    expect(body.error.details.retryAfterSec).toBe(retry);
  });
  it("allows again after the window", async () => {
    state.lastCrawlAt = new Date(Date.now() - CRAWL_MIN_INTERVAL_MS - 1000);
    expect(await crawlRetryAfterSec("org_1", "p1")).toBe(0);
    expect((await postCrawl(req(), ctx)).status).toBe(201);
  });
  it("402 plan_inactive for a suspended workspace", async () => {
    state.org.status = "suspended";
    expect((await postCrawl(req(), ctx)).status).toBe(402);
  });
});

describe("reserveCredits stops scheduled work for inactive orgs", () => {
  it("throws JobError(quota) when the trial has expired", async () => {
    state.org.createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const err = await reserveCredits("org_1", { provider: "openai", taskType: "visibility_prompt", credits: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect((err as JobError).errorClass).toBe("quota");
  });
});
