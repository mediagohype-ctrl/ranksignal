// Keyword research + SERP checker route guards: 401 without a session, other org's project → 404, viewers can't spend,
// not configured → friendly 501, allowance exhausted → 402 { error: "allowance", message }, cache hits are free and
// never call DataForSEO, and history is per organization.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string },
  cache: [] as Record<string, unknown>[],
  searches: [] as Record<string, unknown>[],
  usage: [] as Record<string, unknown>[],
  plan: "growth",
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/billing/ai-budget", () => ({
  reserveAiSpend: async () => ({ release: () => undefined, settle: () => undefined }),
  isAiBudgetExhausted: () => false,
}));
vi.mock("@/lib/db", () => {
  const projects = [
    { id: "p1", organizationId: "o1", websiteUrl: "https://www.acme.in/", name: "Acme", competitors: [{ name: "Rival", domain: "rival.in" }] },
    { id: "p2", organizationId: "o2", websiteUrl: "https://other.in/", name: "Other", competitors: null },
  ];
  const match = (row: Row, where: Where) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  let n = 0;
  const db = {
    project: { findFirst: async ({ where }: { where: Where }) => projects.find((p) => match(p, where)) ?? null },
    organization: { findUnique: async () => ({ planId: h.plan }) },
    dataForSeoUsage: {
      aggregate: async ({ where }: { where: Where }) => ({
        _sum: { units: h.usage.filter((u) => match(u, where)).reduce((s, u) => s + (u.units as number), 0) },
      }),
      create: async ({ data }: { data: Row }) => {
        h.usage.push(data);
        return data;
      },
    },
    researchCache: {
      findUnique: async ({ where }: { where: { requestKey: string } }) => h.cache.find((c) => c.requestKey === where.requestKey) ?? null,
      upsert: async ({ where, create, update }: { where: { requestKey: string }; create: Row; update: Row }) => {
        const row = h.cache.find((c) => c.requestKey === where.requestKey);
        if (row) return Object.assign(row, update);
        h.cache.push({ ...create });
        return create;
      },
    },
    researchSearch: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `search${String(++n).padStart(6, "0")}`, createdAt: new Date(), ...data };
        h.searches.push(row);
        return row;
      },
      findMany: async ({ where }: { where: Where }) => h.searches.filter((s) => match(s, where)).reverse(),
      findFirst: async ({ where }: { where: Where }) => h.searches.find((s) => match(s, where)) ?? null,
    },
  };
  return { db };
});

import { GET as kwGet, POST as kwPost } from "@/app/api/projects/[id]/research/keywords/route";
import { GET as serpGet, POST as serpPost } from "@/app/api/projects/[id]/research/serp/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jreq = (body: unknown) => new Request("https://app.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const LABS_PAYLOAD = {
  status_code: 20000,
  cost: 0.012,
  tasks: [
    {
      status_code: 20000,
      result: [{ total_count: 1, items: [{ keyword: "yoga classes", keyword_info: { search_volume: 1900, cpc: 0.3 }, keyword_properties: { keyword_difficulty: 18 } }] }],
    },
  ],
};
const SERP_PAYLOAD = {
  status_code: 20000,
  cost: 0.002,
  tasks: [
    {
      status_code: 20000,
      result: [
        {
          item_types: ["organic"],
          items: [
            { type: "organic", rank_group: 1, domain: "rival.in", title: "Rival", url: "https://rival.in/" },
            { type: "organic", rank_group: 2, domain: "www.acme.in", title: "Acme", url: "https://www.acme.in/yoga" },
          ],
        },
      ],
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "secret");
  h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "member" };
  h.cache = [];
  h.searches = [];
  h.usage = [];
  h.plan = "growth";
  fetchMock = vi.fn(async (url: string) => {
    const body = url.includes("/serp/") ? SERP_PAYLOAD : LABS_PAYLOAD;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("keyword research routes", () => {
  it("needs a session and scopes projects to the organization", async () => {
    h.session = null;
    expect((await kwGet(new Request("https://app.test/x"), ctx("p1"))).status).toBe(401);
    expect((await kwPost(jreq({ keyword: "yoga" }), ctx("p1"))).status).toBe(401);
    h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "member" };
    expect((await kwPost(jreq({ keyword: "yoga" }), ctx("p2"))).status).toBe(404);
    expect((await serpPost(jreq({ keyword: "yoga" }), ctx("p2"))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("viewers can read but not spend", async () => {
    h.session!.role = "viewer";
    const g = await kwGet(new Request("https://app.test/x"), ctx("p1"));
    expect(g.status).toBe(200);
    expect((await g.json()).allowance).toMatchObject({ used: 0, limit: 200 });
    expect((await kwPost(jreq({ keyword: "yoga" }), ctx("p1"))).status).toBe(403);
    expect((await serpPost(jreq({ keyword: "yoga" }), ctx("p1"))).status).toBe(403);
  });

  it("explains when DataForSEO isn't configured", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const r = await kwPost(jreq({ keyword: "yoga" }), ctx("p1"));
    expect(r.status).toBe(501);
    expect((await r.json()).error.message).toMatch(/isn't switched on yet/);
    expect((await (await kwGet(new Request("https://app.test/x"), ctx("p1"))).json()).configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a friendly 402 when the monthly allowance is used up", async () => {
    h.plan = "trial";
    for (let i = 0; i < 5; i++) h.usage.push({ organizationId: "o1", feature: "keyword_research", units: 1 });
    const r = await kwPost(jreq({ keyword: "yoga" }), ctx("p1"));
    expect(r.status).toBe(402);
    const j = await r.json();
    expect(j.error).toBe("allowance");
    expect(j.message).toMatch(/used all 5/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty or over-long keywords", async () => {
    expect((await kwPost(jreq({ keyword: "  " }), ctx("p1"))).status).toBe(400);
    expect((await kwPost(jreq({ keyword: "x".repeat(81) }), ctx("p1"))).status).toBe(400);
    expect((await kwPost(jreq({ keyword: "yoga", locationId: "mars" }), ctx("p1"))).status).toBe(400);
  });

  it("makes one paid Labs call, then serves the same lookup from the cache for free (even for another org)", async () => {
    const r1 = await kwPost(jreq({ keyword: "  Yoga  Classes ", locationId: "in-pune", languageId: "en" }), ctx("p1"));
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1.fromCache).toBe(false);
    expect(j1.result.items[0]).toMatchObject({ keyword: "yoga classes", volume: 1900, difficulty: 18 });
    expect(j1.allowance.used).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live");
    // Cities fall back to the country for Labs.
    expect(JSON.parse(init.body as string)[0]).toMatchObject({ keyword: "yoga classes", location_code: 2356, language_code: "en" });

    // Same request again (Mumbai is the same country) → cache, no call, no allowance.
    const j2 = await (await kwPost(jreq({ keyword: "yoga classes", locationId: "in-mumbai" }), ctx("p1"))).json();
    expect(j2.fromCache).toBe(true);
    expect(j2.allowance.used).toBe(1);

    // Another organization gets the cached public data too, but not o1's history.
    h.session = { userId: "u2", email: "b@other.in", organizationId: "o2", role: "member" };
    const j3 = await (await kwPost(jreq({ keyword: "yoga classes" }), ctx("p2"))).json();
    expect(j3.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const recent = (await (await kwGet(new Request("https://app.test/x"), ctx("p2"))).json()).recent;
    expect(recent).toHaveLength(1);
    // o2 can't open o1's search.
    const o1Search = h.searches.find((s) => s.organizationId === "o1")!.id as string;
    expect((await kwGet(new Request(`https://app.test/x?search=${o1Search}`), ctx("p2"))).status).toBe(404);
  });

  it("re-opens a past search from the cache without a paid call", async () => {
    const j1 = await (await kwPost(jreq({ keyword: "yoga" }), ctx("p1"))).json();
    const r = await kwGet(new Request(`https://app.test/x?search=${j1.searchId}`), ctx("p1"));
    expect(r.status).toBe(200);
    expect((await r.json()).result.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the 30-day cache has expired", async () => {
    await kwPost(jreq({ keyword: "yoga" }), ctx("p1"));
    h.cache[0].fetchedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const j = await (await kwPost(jreq({ keyword: "yoga" }), ctx("p1"))).json();
    expect(j.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("turns provider failures into a calm 502 without charging the allowance", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("oops", { status: 500 }));
    const r = await kwPost(jreq({ keyword: "yoga" }), ctx("p1"));
    expect(r.status).toBe(502);
    expect((await r.json()).error.message).toMatch(/Nothing was counted/);
    expect(h.usage).toHaveLength(0);
  });
});

describe("SERP checker routes", () => {
  it("checks Google's top 10 with location + device and highlights you and competitors", async () => {
    const r = await serpPost(jreq({ keyword: "Yoga Pune", locationId: "in-pune", device: "desktop" }), ctx("p1"));
    expect(r.status).toBe(200);
    const j = await r.json();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    expect(JSON.parse(init.body as string)[0]).toMatchObject({ keyword: "yoga pune", location_name: "Pune,Maharashtra,India", device: "desktop", depth: 20 });
    expect(j.result.organic.map((o: { match: string | null }) => o.match)).toEqual(["competitor", "you"]);
    expect(j.result.you.position).toBe(2);
    expect(h.usage[0]).toMatchObject({ feature: "serp_checker", units: 1, organizationId: "o1" });

    // Same check within 24h is free; a different device is a new check.
    expect((await (await serpPost(jreq({ keyword: "yoga pune", locationId: "in-pune", device: "desktop" }), ctx("p1"))).json()).fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await serpPost(jreq({ keyword: "yoga pune", locationId: "in-pune", device: "mobile" }), ctx("p1"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const recent = (await (await serpGet(new Request("https://app.test/x"), ctx("p1"))).json()).recent;
    expect(recent).toHaveLength(2);
  });

  it("re-checks after 24 hours", async () => {
    await serpPost(jreq({ keyword: "yoga" }), ctx("p1"));
    h.cache[0].fetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect((await (await serpPost(jreq({ keyword: "yoga" }), ctx("p1"))).json()).fromCache).toBe(false);
  });
});
