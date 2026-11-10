// Competitors API guards and flows: 401 without a session, 404 for another organization's project, viewers can read
// but not spend, friendly 501 when DataForSEO isn't configured, 402 when the allowance is used up, and paid calls
// that hit the right Labs endpoints, cache a snapshot and record usage units.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DFS_NOT_CONFIGURED } from "@/lib/dataforseo/client";
import { resetRateLimit } from "@/lib/auth/rate-limit";

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string },
  used: 0,
  planId: "growth",
  usage: [] as Record<string, unknown>[],
  snapshots: [] as Record<string, unknown>[],
  projects: [] as Record<string, unknown>[],
  calls: [] as { url: string; body: Record<string, unknown>[] }[],
  reply: ((): unknown => ({ status_code: 20000, cost: 0.01, tasks: [{ status_code: 20000, result: [] }] })) as (url: string, body: Record<string, unknown>[]) => unknown,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: async () => undefined, auditActorFromSession: (s: { userId: string }) => ({ actorId: s.userId, actorType: "user" }) }));
vi.mock("@/lib/billing/ai-budget", () => ({
  AiBudgetError: class AiBudgetError extends Error {},
  reserveAiSpend: async () => ({ release: () => undefined, settle: () => undefined }),
}));
vi.mock("@/lib/db", () => {
  const match = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  let n = 0;
  const db = {
    project: {
      findFirst: async ({ where }: { where: Row }) => h.projects.find((p) => match(p, where)) ?? null,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = h.projects.filter((p) => match(p, where));
        rows.forEach((p) => Object.assign(p, data));
        return { count: rows.length };
      },
    },
    organization: { findUnique: async () => ({ planId: h.planId }) },
    dataForSeoUsage: {
      aggregate: async () => ({ _sum: { units: h.used } }),
      create: async ({ data }: { data: Row }) => {
        h.usage.push(data);
        return data;
      },
    },
    competitorSnapshot: {
      upsert: async ({ where, create, update }: { where: { projectId_kind_key: Row }; create: Row; update: Row }) => {
        const k = where.projectId_kind_key;
        const row = h.snapshots.find((s) => s.projectId === k.projectId && s.kind === k.kind && s.key === k.key);
        if (row) return Object.assign(row, update, { updatedAt: new Date() });
        const created = { id: `s${++n}`, ...create, updatedAt: new Date() };
        h.snapshots.push(created);
        return created;
      },
      findMany: async ({ where, skip }: { where: Row; skip?: number }) => h.snapshots.filter((s) => match(s, where)).slice(skip ?? 0),
      deleteMany: async () => ({ count: 0 }),
    },
  };
  return { db };
});

import { GET as view } from "@/app/api/projects/[id]/competitors/route";
import { POST as traffic } from "@/app/api/projects/[id]/competitors/traffic/route";
import { POST as gap } from "@/app/api/projects/[id]/competitors/gap/route";
import { POST as compare } from "@/app/api/projects/[id]/competitors/compare/route";
import { POST as batch } from "@/app/api/projects/[id]/competitors/batch/route";
import { POST as topKeywords } from "@/app/api/projects/[id]/competitors/top-keywords/route";
import { POST as suggest } from "@/app/api/projects/[id]/competitors/suggestions/route";
import { POST as addSuggestion } from "@/app/api/projects/[id]/competitors/suggestions/add/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jreq = (body: unknown) => new Request("https://app.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
  const body = JSON.parse(init.body) as Record<string, unknown>[];
  h.calls.push({ url, body });
  return new Response(JSON.stringify(h.reply(url, body)), { status: 200 });
});

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "secret");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  resetRateLimit("competitors:paid:o1");
  h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "member" };
  h.used = 0;
  h.planId = "growth";
  h.usage = [];
  h.snapshots = [];
  h.calls = [];
  h.projects = [
    { id: "p1", organizationId: "o1", websiteUrl: "https://www.acme.in/", name: "Acme", competitors: [{ name: "Rival", domain: "rival.in", aliases: [] }] },
    { id: "p2", organizationId: "o2", websiteUrl: "https://other.in/", name: "Other", competitors: [] },
  ];
  h.reply = () => ({ status_code: 20000, cost: 0.01, tasks: [{ status_code: 20000, result: [] }] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("competitors route guards", () => {
  it("needs a session", async () => {
    h.session = null;
    expect((await view(new Request("https://app.test/x"), ctx("p1"))).status).toBe(401);
    expect((await traffic(jreq({ domains: ["rival.in"] }), ctx("p1"))).status).toBe(401);
  });

  it("hides other organizations' projects", async () => {
    expect((await view(new Request("https://app.test/x"), ctx("p2"))).status).toBe(404);
    expect((await traffic(jreq({ domains: ["rival.in"] }), ctx("p2"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets viewers read but not spend", async () => {
    h.session!.role = "viewer";
    const r = await view(new Request("https://app.test/x"), ctx("p1"));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.item).toMatchObject({ configured: true, ownDomain: "acme.in", saved: ["rival.in"] });
    expect(j.item.allowances.competitor_traffic).toMatchObject({ used: 0, limit: 200 });
    expect((await traffic(jreq({ domains: ["rival.in"] }), ctx("p1"))).status).toBe(403);
    expect((await addSuggestion(jreq({ domain: "new.in" }), ctx("p1"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains calmly when DataForSEO isn't configured", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const r = await traffic(jreq({ domains: ["rival.in"] }), ctx("p1"));
    expect(r.status).toBe(501);
    expect((await r.json()).error.message).toBe(DFS_NOT_CONFIGURED);
    const v = await (await view(new Request("https://app.test/x"), ctx("p1"))).json();
    expect(v.item.configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses with a friendly 402 when the allowance is used up", async () => {
    h.used = 200;
    const r = await traffic(jreq({ domains: ["rival.in"] }), ctx("p1"));
    expect(r.status).toBe(402);
    const j = await r.json();
    expect(j.error).toBe("allowance");
    expect(j.message).toMatch(/used all 200/);
    // Not enough left for all the domains asked for.
    h.used = 198;
    const r2 = await traffic(jreq({ domains: ["rival.in", "a.in", "b.in"] }), ctx("p1"));
    expect(r2.status).toBe(402);
    expect((await r2.json()).message).toMatch(/needs 3/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates domains", async () => {
    expect((await traffic(jreq({ domains: ["not a domain"] }), ctx("p1"))).status).toBe(400);
    expect((await traffic(jreq({ domains: ["a.in", "b.in", "c.in", "d.in", "e.in", "f.in"] }), ctx("p1"))).status).toBe(400);
    expect((await gap(jreq({ competitor: "https://acme.in" }), ctx("p1"))).status).toBe(400);
    expect((await compare(jreq({ domains: ["a.in", "www.a.in"] }), ctx("p1"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("paid competitor actions", () => {
  it("checks traffic per domain, caches it and records one unit each", async () => {
    h.reply = (_url, body) => ({
      status_code: 20000,
      cost: 0.0101,
      tasks: [{ status_code: 20000, result: [{ items: [{ metrics: { organic: { etv: body[0].target === "acme.in" ? 50 : 900, count: 10, pos_1: 1 } } }] }] }],
    });
    const r = await traffic(jreq({ domains: ["acme.in", "https://rival.in"], locationId: "in-pune" }), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls.map((c) => c.url)).toEqual([
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
    ]);
    expect(h.calls[1].body[0]).toEqual({ target: "rival.in", location_code: 2356, language_code: "en" });
    expect(h.usage).toHaveLength(2);
    expect(h.usage.every((u) => u.feature === "competitor_traffic" && u.units === 1 && u.projectId === "p1")).toBe(true);
    const j = await r.json();
    expect(j.result.ok.map((o: { traffic: number }) => o.traffic)).toEqual([50, 900]);
    expect(j.item.overviews.map((o: { key: string }) => o.key).sort()).toEqual(["acme.in|in|en", "rival.in|in|en"]);
    expect(h.snapshots.every((s) => s.organizationId === "o1")).toBe(true);
  });

  it("runs the keyword gap as two domain_intersection calls (1 unit)", async () => {
    h.reply = (_url, body) => ({
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        result: [{
          items: body[0].intersections === false
            ? [{ keyword_data: { keyword: "braces price", keyword_info: { search_volume: 3600 } }, first_domain_serp_element: { rank_group: 5 }, second_domain_serp_element: null }]
            : [{ keyword_data: { keyword: "dentist pune", keyword_info: { search_volume: 2400 } }, first_domain_serp_element: { rank_group: 2 }, second_domain_serp_element: { rank_group: 40 } }],
        }],
      }],
    });
    const r = await gap(jreq({ competitor: "rival.in" }), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls).toHaveLength(2);
    expect(h.calls[0].url).toContain("/v3/dataforseo_labs/google/domain_intersection/live");
    expect(h.calls[0].body[0]).toMatchObject({ target1: "rival.in", target2: "acme.in", intersections: false });
    expect(h.calls[1].body[0]).toMatchObject({ intersections: true });
    expect(h.usage.reduce((s, u) => s + (u.units as number), 0)).toBe(1);
    const j = await r.json();
    expect(j.result.rows.map((x: { keyword: string }) => x.keyword)).toEqual(["braces price", "dentist pune"]);
    expect(j.item.gaps[0].key).toBe("rival.in>acme.in|in|en");
  });

  it("compares domains in one bulk call", async () => {
    const r = await compare(jreq({ domains: ["acme.in", "rival.in"] }), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls[0].url).toContain("bulk_traffic_estimation");
    expect(h.calls[0].body[0].targets).toEqual(["acme.in", "rival.in"]);
    expect(h.usage).toEqual([expect.objectContaining({ feature: "domain_compare", units: 1 })]);
    expect((await r.json()).item.compare.data.domains).toEqual(["acme.in", "rival.in"]);
  });

  it("charges batches 1 unit per 50 domains and enforces the plan size", async () => {
    const list = Array.from({ length: 51 }, (_, i) => `site${i}.in`).join("\n");
    const r = await batch(jreq({ text: list }), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls[0].body[0].targets).toHaveLength(51);
    expect(h.usage).toEqual([expect.objectContaining({ feature: "domain_compare", units: 2 })]);
    h.planId = "starter";
    const tooMany = await batch(jreq({ text: list }), ctx("p1"));
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).error.message).toMatch(/up to 50/);
    expect((await batch(jreq({ text: "nothing useful" }), ctx("p1"))).status).toBe(400);
  });

  it("maps provider failures to a calm message", async () => {
    h.reply = () => ({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field" }] });
    const r = await topKeywords(jreq({ domain: "rival.in" }), ctx("p1"));
    expect(r.status).toBe(502);
    expect((await r.json()).error.message).toMatch(/data partner/);
    expect(h.snapshots).toHaveLength(0);
  });

  it("suggests competitors and adds one to the saved list", async () => {
    h.reply = () => ({
      status_code: 20000,
      tasks: [{ status_code: 20000, result: [{ items: [{ domain: "rival.in", intersections: 50 }, { domain: "newrival.in", intersections: 30 }] }] }],
    });
    const r = await suggest(jreq({}), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls[0].body[0]).toMatchObject({ target: "acme.in", exclude_top_domains: true });
    expect((await r.json()).result.items.map((s: { domain: string }) => s.domain)).toEqual(["newrival.in"]);

    const add = await addSuggestion(jreq({ domain: "https://newrival.in" }), ctx("p1"));
    expect(add.status).toBe(200);
    const j = await add.json();
    expect(j.added).toBe(true);
    expect(j.item.saved).toEqual(["rival.in", "newrival.in"]);
    expect((await (await addSuggestion(jreq({ domain: "newrival.in" }), ctx("p1"))).json()).added).toBe(false);
    expect((await addSuggestion(jreq({ domain: "acme.in" }), ctx("p1"))).status).toBe(400);
  });
});
