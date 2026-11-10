// Rank tracker API guards: sign-in, tenant scoping, roles (viewers read; members add/remove/check), plan keyword
// limit, "Check now" once a day, allowance exhausted → 402 { error: "allowance" }, not configured → friendly 501, CSV.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { createFakeDb } from "./fake-db";

const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string; readOnly?: boolean },
  fake: null as unknown as ReturnType<typeof createFakeDb>,
  enqueued: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: async () => undefined, auditActorFromSession: (s: { userId: string }) => ({ actorId: s.userId, actorType: "user" }) }));
vi.mock("@/lib/jobs/queue", () => ({
  enqueue: async (o: Record<string, unknown>) => {
    h.enqueued.push(o);
    return { id: `run${h.enqueued.length}`, ...o };
  },
}));
vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("./fake-db");
  h.fake = createFakeDb();
  return { db: h.fake.db };
});

import { DELETE as remove, GET as view, POST as add } from "@/app/api/projects/[id]/rankings/route";
import { POST as check } from "@/app/api/projects/[id]/rankings/check/route";
import { resetRateLimit } from "@/lib/auth/rate-limit";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jreq = (method: string, body?: unknown, url = "https://app.test/api/projects/p1/rankings") =>
  new Request(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (qs = "") => new Request(`https://app.test/api/projects/p1/rankings${qs}`);

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "secret");
  h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "member" };
  const t = h.fake.t;
  t.keywords = [];
  t.checks = [];
  t.states = [];
  t.stars = [];
  t.usage = [];
  t.runs = [];
  t.orgs.o1.planId = "trial";
  h.enqueued = [];
  resetRateLimit("rank-check:o1");
});
afterEach(() => vi.unstubAllEnvs());

describe("rank tracker routes", () => {
  it("requires sign-in", async () => {
    h.session = null;
    expect((await view(get(), ctx("p1"))).status).toBe(401);
    expect((await add(jreq("POST", { keywords: ["a"] }), ctx("p1"))).status).toBe(401);
    expect((await check(jreq("POST"), ctx("p1"))).status).toBe(401);
  });

  it("hides other organizations' projects", async () => {
    expect((await view(get(), ctx("p2"))).status).toBe(404);
    expect((await add(jreq("POST", { keywords: ["a"] }), ctx("p2"))).status).toBe(404);
    expect((await check(jreq("POST"), ctx("p2"))).status).toBe(404);
    expect((await remove(jreq("DELETE", { ids: ["k1"] }), ctx("p2"))).status).toBe(404);
  });

  it("lets viewers read but not add, remove or spend", async () => {
    h.session!.role = "viewer";
    const r = await view(get(), ctx("p1"));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.item).toMatchObject({ configured: true, domain: "acme.in", frequency: "weekly", limit: 10, rows: [] });
    expect(j.item.allowance).toMatchObject({ used: 0, limit: 40 });
    expect((await add(jreq("POST", { keywords: ["dentist pune"] }), ctx("p1"))).status).toBe(403);
    expect((await remove(jreq("DELETE", { ids: ["k1"] }), ctx("p1"))).status).toBe(403);
    expect((await check(jreq("POST"), ctx("p1"))).status).toBe(403);
  });

  it("adds keywords up to the plan limit and reports what was skipped", async () => {
    const keywords = Array.from({ length: 12 }, (_, i) => `Keyword ${i}`);
    const r = await add(jreq("POST", { keywords, locationId: "in-pune", device: "desktop" }), ctx("p1"));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j).toMatchObject({ added: 10, skipped: 2, limit: 10 });
    expect(h.fake.t.keywords[0]).toMatchObject({ organizationId: "o1", projectId: "p1", keyword: "keyword 0", locationId: "in-pune", device: "desktop", createdById: "u1" });

    h.fake.t.orgs.o1.planId = "starter";
    const again = await (await add(jreq("POST", { keywords: ["keyword 0", "new one"], locationId: "in-pune", device: "desktop" }), ctx("p1"))).json();
    expect(again).toMatchObject({ added: 1, skipped: 1, limit: 50 });
  });

  it("rejects empty or junk keyword lists and unknown devices", async () => {
    expect((await add(jreq("POST", { keywords: ["   ", "x".repeat(100)] }), ctx("p1"))).status).toBe(400);
    expect((await add(jreq("POST", { keywords: [] }), ctx("p1"))).status).toBe(400);
    expect((await add(jreq("POST", { keywords: ["a"], device: "tablet" }), ctx("p1"))).status).toBe(400);
  });

  it("removes only this project's keywords", async () => {
    await add(jreq("POST", { keywords: ["a", "b"] }), ctx("p1"));
    h.fake.t.keywords.push({ id: "foreign", organizationId: "o2", projectId: "p2", keyword: "x", active: true });
    const ids = h.fake.t.keywords.map((k) => k.id as string);
    const j = await (await remove(jreq("DELETE", { ids }), ctx("p1"))).json();
    expect(j.removed).toBe(2);
    expect(h.fake.t.keywords.map((k) => k.id)).toEqual(["foreign"]);
  });

  it("Check now: friendly error when DataForSEO isn't configured", async () => {
    await add(jreq("POST", { keywords: ["a"] }), ctx("p1"));
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const r = await check(jreq("POST"), ctx("p1"));
    expect(r.status).toBe(501);
    expect((await r.json()).error.message).toMatch(/isn't switched on yet/);
    expect(h.enqueued).toHaveLength(0);
  });

  it("Check now: 402 allowance error when the month's checks are used up", async () => {
    await add(jreq("POST", { keywords: ["a"] }), ctx("p1"));
    h.fake.t.usage.push({ organizationId: "o1", feature: "rank_tracker", units: 40, createdAt: new Date() });
    const r = await check(jreq("POST"), ctx("p1"));
    expect(r.status).toBe(402);
    const j = await r.json();
    expect(j.error).toBe("allowance");
    expect(j.message).toMatch(/used all 40/);
    expect(h.enqueued).toHaveLength(0);
  });

  it("Check now: queues a manual run once a day", async () => {
    expect((await check(jreq("POST"), ctx("p1"))).status).toBe(400); // nothing tracked yet
    await add(jreq("POST", { keywords: ["a", "b"] }), ctx("p1"));
    const r = await check(jreq("POST"), ctx("p1"));
    expect(r.status).toBe(202);
    expect((await r.json()).queued).toBe(2);
    expect(h.enqueued[0]).toMatchObject({ kind: "rank_tracker", organizationId: "o1", projectId: "p1", input: { projectId: "p1", trigger: "manual" } });
    const second = await check(jreq("POST"), ctx("p1"));
    expect(second.status).toBe(429);
    expect(h.enqueued).toHaveLength(1);
  });

  it("exports current positions as CSV and serves history scoped to the project", async () => {
    await add(jreq("POST", { keywords: ["dentist pune"] }), ctx("p1"));
    const k = h.fake.t.keywords[0];
    Object.assign(k, { lastCheckedAt: new Date(), lastPosition: 4, bestPosition: 3, lastUrl: "https://acme.in/x", lastFeatures: ["ai_overview"], lastCompetitors: [{ domain: "a.com", position: 1 }] });
    h.fake.t.checks.push({ id: "c1", organizationId: "o1", trackedKeywordId: k.id, checkedAt: new Date(), position: 4 });
    h.session!.role = "viewer";
    const r = await view(get("?format=csv"), ctx("p1"));
    expect(r.headers.get("content-type")).toMatch(/text\/csv/);
    const csv = await r.text();
    expect(csv).toContain("dentist pune,All of India,mobile,4,");
    expect(csv).toContain("a.com (#1)");

    const hist = await (await view(get(`?keywordId=${k.id}`), ctx("p1"))).json();
    expect(hist.points).toEqual([{ checkedAt: expect.any(String), position: 4 }]);
    h.session = { userId: "u2", email: "b@other.in", organizationId: "o2", role: "owner" };
    expect((await view(new Request(`https://app.test/api/projects/p2/rankings?keywordId=${k.id}`), ctx("p2"))).status).toBe(404);
  });
});
