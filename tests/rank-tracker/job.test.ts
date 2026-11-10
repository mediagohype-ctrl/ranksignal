// Rank tracker job + scheduler entry: real dfsPost with a mocked fetch, in-memory DB. Checks are stored per keyword,
// usage is recorded as feature "rank_tracker", the allowance pauses the tracker instead of failing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "./fake-db";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof createFakeDb>,
  enqueued: [] as Record<string, unknown>[],
  bodies: [] as Record<string, unknown>[],
  fetchUrls: [] as string[],
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueue: async (o: Record<string, unknown>) => {
    h.enqueued.push(o);
    return { id: `run${h.enqueued.length}`, ...o };
  },
}));
vi.mock("@/lib/billing/ai-budget", () => ({
  reserveAiSpend: async () => ({ settle: () => undefined, release: () => undefined }),
  isAiBudgetExhausted: (e: unknown) => !!(e as { aiBudget?: boolean })?.aiBudget,
}));
vi.mock("@/lib/billing/access", () => ({ getOrgAccess: async () => ({ active: true }) }));
vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("./fake-db");
  h.fake = createFakeDb();
  return { db: h.fake.db };
});

import { createRankTrackerJob, scheduleDueRankChecks } from "@/lib/rank-tracker/job";

function serp(keyword: string) {
  // Acme ranks #2 for "dentist pune", nowhere for other keywords.
  const items =
    keyword === "dentist pune"
      ? [
          { type: "ai_overview", rank_group: 1, rank_absolute: 1 },
          { type: "organic", rank_group: 1, rank_absolute: 2, domain: "www.practo.com", url: "https://www.practo.com/pune" },
          { type: "organic", rank_group: 2, rank_absolute: 3, domain: "www.acme.in", url: "https://www.acme.in/dentist" },
        ]
      : [{ type: "organic", rank_group: 1, rank_absolute: 1, domain: "justdial.com", url: "https://justdial.com/" }];
  return {
    status_code: 20000,
    status_message: "Ok.",
    cost: 0.002,
    tasks: [{ status_code: 20000, status_message: "Ok.", cost: 0.002, result: [{ keyword, item_types: [...new Set(items.map((i) => i.type))], items }] }],
  };
}

const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  h.fetchUrls.push(url);
  const body = (JSON.parse(String(init.body)) as Record<string, unknown>[])[0];
  h.bodies.push(body);
  return new Response(JSON.stringify(serp(String(body.keyword))), { status: 200 });
});

const noSleep = async () => undefined;
const job = createRankTrackerJob({ post: (await import("@/lib/dataforseo/client")).dfsPost, sleep: noSleep });
const ctx = (input: Record<string, unknown> = { projectId: "p1", trigger: "schedule" }) => ({
  run: { id: "r1", organizationId: "o1", projectId: "p1", input, attempts: 0 },
  transition: async () => undefined,
  event: async () => undefined,
});

function addKeywords(list: string[], extra: Record<string, unknown> = {}) {
  for (const keyword of list) {
    h.fake.t.keywords.push({
      id: `k-${keyword}`, organizationId: "o1", projectId: "p1", keyword, locationId: "in-pune", device: "mobile", language: "en", active: true,
      lastCheckedAt: null, bestPosition: null, createdAt: new Date(), ...extra,
    });
  }
}

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "secret");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  const t = h.fake.t;
  t.keywords = [];
  t.checks = [];
  t.states = [];
  t.usage = [];
  t.runs = [];
  t.orgs.o1.planId = "trial";
  h.enqueued = [];
  h.bodies = [];
  h.fetchUrls = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("rank tracker job", () => {
  it("checks due keywords, stores results and records usage", async () => {
    addKeywords(["dentist pune", "root canal"]);
    const out = await job(ctx());
    expect(out).toMatchObject({ checked: 2, failed: 0 });
    expect(h.fetchUrls[0]).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    expect(h.bodies[0]).toEqual({ keyword: "dentist pune", location_name: "Pune,Maharashtra,India", language_code: "en", device: "mobile", os: "android", depth: 100 });

    const k = h.fake.t.keywords.find((x) => x.keyword === "dentist pune")!;
    expect(k).toMatchObject({ lastPosition: 2, bestPosition: 2, lastUrl: "https://www.acme.in/dentist", lastFeatures: ["ai_overview"], lastError: null });
    expect(k.lastCompetitors).toEqual([{ domain: "practo.com", position: 1 }]);
    const other = h.fake.t.keywords.find((x) => x.keyword === "root canal")!;
    expect(other.lastPosition).toBeNull();
    expect(other.lastCheckedAt).toBeInstanceOf(Date);

    expect(h.fake.t.checks).toHaveLength(2);
    expect(h.fake.t.checks[0]).toMatchObject({ organizationId: "o1", position: 2, trigger: "schedule" });
    expect(h.fake.t.usage).toHaveLength(2);
    expect(h.fake.t.usage[0]).toMatchObject({ organizationId: "o1", projectId: "p1", feature: "rank_tracker", units: 1, costMicros: 2000 });

    // Nothing due any more → a second run makes no paid calls.
    fetchMock.mockClear();
    expect(await job(ctx())).toMatchObject({ checked: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pauses (doesn't fail) when the monthly allowance runs out", async () => {
    addKeywords(["a1", "a2", "a3", "a4", "a5"]);
    h.fake.t.usage.push({ organizationId: "o1", feature: "rank_tracker", units: 38, createdAt: new Date() }); // trial = 40
    const out = await job(ctx());
    expect(out).toMatchObject({ checked: 2, paused: "allowance" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.fake.t.states[0]).toMatchObject({ projectId: "p1", status: "paused_allowance" });
    expect(String(h.fake.t.states[0].message)).toMatch(/^Paused: allowance used up\./);
  });

  it("does nothing without DataForSEO credentials", async () => {
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    addKeywords(["a1"]);
    expect(await job(ctx())).toMatchObject({ checked: 0, skipped: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manual runs re-check keywords checked before the request, even if not due", async () => {
    const recent = new Date(Date.now() - 3_600_000);
    addKeywords(["dentist pune"], { lastCheckedAt: recent });
    expect(await job(ctx())).toMatchObject({ checked: 0 }); // weekly schedule: not due
    expect(await job(ctx({ projectId: "p1", trigger: "manual", since: new Date().toISOString() }))).toMatchObject({ checked: 1 });
    expect(h.fake.t.checks[0].trigger).toBe("manual");
  });

  it("keeps the best position when a later check is worse", async () => {
    addKeywords(["dentist pune"], { bestPosition: 1 });
    await job(ctx());
    expect(h.fake.t.keywords[0]).toMatchObject({ lastPosition: 2, bestPosition: 1 });
  });

  it("only checks keywords inside the plan limit", async () => {
    addKeywords(Array.from({ length: 12 }, (_, i) => `kw ${i}`));
    expect(await job(ctx())).toMatchObject({ checked: 10 });
  });
});

describe("scheduleDueRankChecks", () => {
  it("enqueues projects with due keywords, skipping busy and paused ones", async () => {
    addKeywords(["a1"]);
    expect(await scheduleDueRankChecks()).toBe(1);
    expect(h.enqueued[0]).toMatchObject({ kind: "rank_tracker", organizationId: "o1", projectId: "p1", input: { trigger: "schedule" } });

    h.enqueued = [];
    h.fake.t.runs.push({ id: "w1", organizationId: "o1", projectId: "p1", kind: "rank_tracker", state: "running", createdAt: new Date(Date.now() - 3_600_000) });
    expect(await scheduleDueRankChecks()).toBe(0);

    h.fake.t.runs = [];
    h.fake.t.usage.push({ organizationId: "o1", feature: "rank_tracker", units: 40, createdAt: new Date() });
    expect(await scheduleDueRankChecks()).toBe(0);
    expect(h.fake.t.states[0]).toMatchObject({ status: "paused_allowance" });
  });

  it("does nothing when not configured or nothing is due", async () => {
    addKeywords(["a1"], { lastCheckedAt: new Date() });
    expect(await scheduleDueRankChecks()).toBe(0);
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    h.fake.t.keywords = [];
    addKeywords(["a2"]);
    expect(await scheduleDueRankChecks()).toBe(0);
  });
});
