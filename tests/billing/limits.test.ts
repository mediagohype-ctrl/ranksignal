import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  org: { planId: "trial", status: "active", createdAt: new Date() } as { planId: string; status: string; createdAt: Date },
  answersThisMonth: 0,
  inFlight: [] as { sampleSize: number; collected: number; failed: number }[],
  observationCountWhere: null as unknown,
  lastCrawlAt: null as Date | null,
  activeCrawl: false,
  promptCount: 5,
  enqueued: [] as { kind: string; input: Record<string, unknown> }[],
}));

vi.mock("@/lib/db", () => {
  const db = {
    organization: { findUnique: vi.fn(async () => state.org) },
    subscription: { findMany: vi.fn(async () => []) },
    observation: {
      count: vi.fn(async (args: { where: unknown }) => {
        state.observationCountWhere = args.where;
        return state.answersThisMonth;
      }),
    },
    visibilityRun: {
      findMany: vi.fn(async () => state.inFlight),
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
import { crawlRetryAfterSec, CRAWL_MIN_INTERVAL_MS, getRunPromptCap, getVisibilityRunAllowance, sizeRunToAllowance } from "@/lib/billing/ai-limits";
import { answersPerCheck, checksPerMonth, PLANS } from "@/lib/billing/plans";
import { reserveCredits } from "@/lib/billing/usage";
import { JobError } from "@/lib/types";

const ctx = { params: Promise.resolve({ id: "p1" }) };
const req = (body = "") => new Request("http://localhost/api/projects/p1/x", { method: "POST", body });

beforeEach(() => {
  state.org = { planId: "trial", status: "active", createdAt: new Date() };
  state.answersThisMonth = 0;
  state.inFlight = [];
  state.lastCrawlAt = null;
  state.activeCrawl = false;
  state.promptCount = 5;
  state.enqueued = [];
});

describe("plan AI limits", () => {
  it("limits by AI answers per month: trial 30, starter 300, growth 1,200, agency 6,000", () => {
    expect([PLANS.trial, PLANS.starter, PLANS.growth, PLANS.agency].map((p) => [p.aiAnswersPerMonth, p.maxPromptsPerRun, p.enginesPerCheck])).toEqual([
      [30, 10, 3],
      [300, 25, 3],
      [1_200, 40, 5],
      [6_000, 100, 5],
    ]);
  });
  it("answers per month are whole checks (questions × engines); trial = exactly 1 check", () => {
    for (const id of ["trial", "starter", "growth", "agency"] as const) {
      expect(PLANS[id].aiAnswersPerMonth % answersPerCheck(id)).toBe(0);
    }
    expect(checksPerMonth("trial")).toBe(1);
    expect(answersPerCheck("trial")).toBe(30);
  });
  it("prompt cap per run follows the plan", async () => {
    expect(await getRunPromptCap("org_1")).toBe(10);
    state.org.planId = "agency";
    expect(await getRunPromptCap("org_1")).toBe(100);
  });
  it("counts this month's real answers plus answers held by checks in progress", async () => {
    state.org.planId = "growth";
    state.answersThisMonth = 300;
    state.inFlight = [{ sampleSize: 200, collected: 50, failed: 10 }];
    const a = await getVisibilityRunAllowance("org_1", new Date("2026-11-04T00:00:00Z"));
    expect(a).toMatchObject({ used: 440, limit: 1_200, remaining: 760 });
    expect(a.resetsAt?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(state.observationCountWhere).toMatchObject({ organizationId: "org_1", simulated: false, createdAt: { gte: new Date("2026-11-01T00:00:00Z") } });
  });
});

describe("sizeRunToAllowance", () => {
  it("keeps the full check when it fits", () => expect(sizeRunToAllowance(30, 10, 3)).toEqual({ questions: 10, engines: 3 }));
  it("drops questions first so every engine is asked the same questions", () => expect(sizeRunToAllowance(20, 10, 3)).toEqual({ questions: 6, engines: 3 }));
  it("with fewer answers than engines, asks one question on as many engines as fit", () => expect(sizeRunToAllowance(2, 10, 3)).toEqual({ questions: 1, engines: 2 }));
  it("nothing left → nothing", () => expect(sizeRunToAllowance(0, 10, 3)).toEqual({ questions: 0, engines: 0 }));
});

describe("POST visibility-runs", () => {
  it("creates a run and passes the prompt cap to the job", async () => {
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(201);
    expect(state.enqueued[0]).toMatchObject({ kind: "visibility", input: { maxPrompts: 10 } });
  });
  it("accepts OpenRouter engine ids and rejects unknown ones", async () => {
    expect((await postVisibility(req(JSON.stringify({ providers: ["openrouter:anthropic/claude-opus-5.5", "gemini"] })), ctx)).status).toBe(201);
    expect((await postVisibility(req(JSON.stringify({ providers: ["bing"] })), ctx)).status).toBe(400);
  });
  it("402 plan_limit with the reset date when the month's AI answers are used", async () => {
    state.org.planId = "starter";
    state.answersThisMonth = 300;
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("plan_limit");
    expect(body.error.message).toMatch(/AI answers.*reset on 1 \w+ \d{4}/i);
    expect(body.error.details.resetsAt).toMatch(/-01T00:00:00/);
    expect(state.enqueued).toHaveLength(0);
  });
  it("trial: 402 once the 30 trial answers are used (no reset date)", async () => {
    state.answersThisMonth = 30;
    const res = await postVisibility(req(), ctx);
    expect(res.status).toBe(402);
    expect((await res.json()).error.message).toMatch(/free trial/);
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
