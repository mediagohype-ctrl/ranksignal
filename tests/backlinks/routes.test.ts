// Backlinks API guards: sign-in, tenant scoping, roles (viewer reads, member+ spends), not configured / not switched on,
// allowance, once-a-day refresh, "no Backlinks subscription" answer, and the paid calls actually sent. fetch is mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANCHORS_RESULT, BACKLINKS_RESULT, DOMAINS_RESULT, INTERSECTION_RESULT, NEW_LOST_RESULT, SUMMARY_RESULT } from "./samples";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string; readOnly?: boolean },
  plan: "growth",
  usage: [] as Record<string, unknown>[],
  monitors: [] as Record<string, unknown>[],
  snapshots: [] as Record<string, unknown>[],
  reports: [] as Record<string, unknown>[],
  calls: [] as { path: string; body: unknown }[],
  denyAccess: false,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/billing/ai-budget", () => ({ reserveAiSpend: async () => ({ release: () => undefined, settle: () => undefined }) }));
vi.mock("@/lib/billing/access", () => ({ getOrgAccess: async () => ({ active: true }) }));
vi.mock("@/lib/db", () => {
  const projects = [
    { id: "p1", organizationId: "o1", websiteUrl: "https://www.acme.in/", name: "Acme", competitors: [{ name: "Rival", domain: "rival.in" }] },
    { id: "p2", organizationId: "o2", websiteUrl: "https://other.test/", name: "Other", competitors: null },
  ];
  const match = (row: Row, where: Where = {}) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  const findMany = (rows: () => Row[]) => async (q: { where?: Where; skip?: number; take?: number } = {}) => {
    const list = rows()
      .filter((r) => match(r, q.where))
      .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
    return list.slice(q.skip ?? 0, (q.skip ?? 0) + (q.take ?? list.length));
  };
  let n = 0;
  const db = {
    project: { findFirst: async ({ where }: { where: Where }) => projects.find((p) => match(p, where)) ?? null },
    organization: { findUnique: async () => ({ planId: h.plan }) },
    dataForSeoUsage: {
      aggregate: async ({ where }: { where: Where }) => ({
        _sum: { units: h.usage.filter((u) => match(u, where)).reduce((s, u) => s + (u.units as number), 0) },
      }),
      create: async ({ data }: { data: Row }) => (h.usage.push(data), data),
    },
    backlinkMonitor: {
      findFirst: async ({ where }: { where: Where }) => h.monitors.find((m) => match(m, where)) ?? null,
      findMany: async () => h.monitors,
      upsert: async ({ where, create, update }: { where: { projectId: string }; create: Row; update: Row }) => {
        const row = h.monitors.find((m) => m.projectId === where.projectId);
        if (row) return Object.assign(row, update);
        const created = { id: `m${++n}`, lastRefreshAt: null, lastError: null, ...create };
        h.monitors.push(created);
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(h.monitors.find((m) => m.id === where.id)!, data),
    },
    backlinkSnapshot: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `s${++n}`, createdAt: new Date(), ...data };
        h.snapshots.push(row);
        return row;
      },
      findMany: findMany(() => h.snapshots),
      deleteMany: async () => ({ count: 0 }),
    },
    linkGapReport: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `r${++n}`, createdAt: new Date(), ...data };
        h.reports.push(row);
        return row;
      },
      findMany: findMany(() => h.reports),
      deleteMany: async () => ({ count: 0 }),
    },
  };
  return { db };
});

import { GET as view } from "@/app/api/projects/[id]/backlinks/route";
import { POST as refresh } from "@/app/api/projects/[id]/backlinks/refresh/route";
import { POST as linkGap } from "@/app/api/projects/[id]/backlinks/link-gap/route";
import { DFS_NOT_CONFIGURED } from "@/lib/dataforseo/client";
import { BACKLINKS_NOT_ENABLED } from "@/lib/backlinks/errors";
import { isRefreshDue, linkGapTask, cleanCompetitors, refreshCalls, savedCompetitorDomains } from "@/lib/backlinks/service";

const RESULTS: Record<string, unknown[]> = {
  "/v3/backlinks/summary/live": SUMMARY_RESULT,
  "/v3/backlinks/referring_domains/live": DOMAINS_RESULT,
  "/v3/backlinks/backlinks/live": BACKLINKS_RESULT,
  "/v3/backlinks/anchors/live": ANCHORS_RESULT,
  "/v3/backlinks/timeseries_new_lost_summary/live": NEW_LOST_RESULT,
  "/v3/backlinks/domain_intersection/live": INTERSECTION_RESULT,
};

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = () => new Request("https://app.test/x");
const post = (body: unknown = {}) =>
  new Request("https://app.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "secret");
  vi.stubEnv("DATAFORSEO_BACKLINKS_ENABLED", "true");
  h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "member" };
  h.plan = "growth";
  h.usage = [];
  h.monitors = [];
  h.snapshots = [];
  h.reports = [];
  h.calls = [];
  h.denyAccess = false;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    h.calls.push({ path, body: JSON.parse(String(init.body)) });
    const task = h.denyAccess
      ? { status_code: 40204, status_message: "Access denied. Visit Plans and Subscriptions to activate your subscription and get access to this API", result: null }
      : { status_code: 20000, cost: 0.02, result: RESULTS[path] ?? [] };
    return new Response(JSON.stringify({ status_code: 20000, tasks: [task] }), { status: 200 });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("backlinks routes: guards", () => {
  it("needs a signed-in user and hides other organizations' projects", async () => {
    h.session = null;
    expect((await view(get(), ctx("p1"))).status).toBe(401);
    expect((await refresh(post(), ctx("p1"))).status).toBe(401);
    h.session = { userId: "u1", email: "a@acme.in", organizationId: "o1", role: "admin" };
    expect((await view(get(), ctx("p2"))).status).toBe(404);
    expect((await refresh(post(), ctx("p2"))).status).toBe(404);
    expect((await linkGap(post({ competitors: ["rival.in"] }), ctx("p2"))).status).toBe(404);
    expect(h.calls).toHaveLength(0);
  });

  it("viewers can read but not spend", async () => {
    h.session!.role = "viewer";
    const r = await view(get(), ctx("p1"));
    expect(r.status).toBe(200);
    const item = (await r.json()).item;
    expect(item.target).toBe("acme.in");
    expect(item.linkGap.savedCompetitors).toEqual(["rival.in"]);
    expect((await refresh(post(), ctx("p1"))).status).toBe(403);
    expect((await linkGap(post({ competitors: ["rival.in"] }), ctx("p1"))).status).toBe(403);
    expect(h.calls).toHaveLength(0);
  });

  it("explains calmly when DataForSEO isn't connected, or the Backlinks API isn't switched on", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    let r = await refresh(post(), ctx("p1"));
    expect(r.status).toBe(501);
    expect((await r.json()).error.message).toBe(DFS_NOT_CONFIGURED);
    const v = (await (await view(get(), ctx("p1"))).json()).item;
    expect(v.availability).toMatchObject({ configured: false, enabled: false });
    vi.stubEnv("DATAFORSEO_LOGIN", "login");
    vi.stubEnv("DATAFORSEO_BACKLINKS_ENABLED", "");
    r = await refresh(post(), ctx("p1"));
    expect(r.status).toBe(503);
    expect((await r.json()).error.message).toBe(BACKLINKS_NOT_ENABLED);
    r = await linkGap(post({ competitors: ["rival.in"] }), ctx("p1"));
    expect((await r.json()).error.message).toBe(BACKLINKS_NOT_ENABLED);
    expect(h.calls).toHaveLength(0);
  });

  it("refuses with a friendly allowance message before calling DataForSEO", async () => {
    h.usage.push({ organizationId: "o1", feature: "backlinks", units: 100 }); // growth: 100 used → none left
    const r = await refresh(post(), ctx("p1"));
    expect(r.status).toBe(402);
    const body = await r.json();
    expect(body.error.code).toBe("allowance");
    expect(body.error.message).toMatch(/used all 100/);
    h.plan = "trial";
    h.usage = [{ organizationId: "o1", feature: "link_gap", units: 1 }];
    expect((await linkGap(post({ competitors: ["rival.in"] }), ctx("p1"))).status).toBe(402);
    expect(h.calls).toHaveLength(0);
  });
});

describe("backlinks routes: paid calls", () => {
  it("refreshes with 5 calls, stores a snapshot, records usage, and allows one refresh a day", async () => {
    const r = await refresh(post(), ctx("p1"));
    expect(r.status).toBe(200);
    expect(h.calls.map((c) => c.path)).toEqual([
      "/v3/backlinks/summary/live",
      "/v3/backlinks/referring_domains/live",
      "/v3/backlinks/backlinks/live",
      "/v3/backlinks/anchors/live",
      "/v3/backlinks/timeseries_new_lost_summary/live",
    ]);
    expect((h.calls[0].body as Row[])[0]).toMatchObject({ target: "acme.in", include_subdomains: true });
    expect((h.calls[2].body as Row[])[0]).toMatchObject({ mode: "one_per_domain", limit: 100 });
    expect(h.snapshots).toHaveLength(1);
    expect(h.snapshots[0]).toMatchObject({ organizationId: "o1", projectId: "p1", backlinks: 1240, referringDomains: 96, rank: 38, trigger: "manual" });
    expect(h.usage.filter((u) => u.feature === "backlinks")).toHaveLength(5);
    const item = (await r.json()).item;
    expect(item.latest.data.referringDomains[0].domain).toBe("timesofindia.com");
    expect(item.allowance).toMatchObject({ used: 1, limit: 100, refreshesLeft: 99 });

    // Viewing again never calls DataForSEO.
    await view(get(), ctx("p1"));
    expect(h.calls).toHaveLength(5);
    const again = await refresh(post(), ctx("p1"));
    expect(again.status).toBe(429);
    expect(h.calls).toHaveLength(5);
  });

  it("shows 'not switched on' when DataForSEO refuses the Backlinks API, after a single call", async () => {
    h.denyAccess = true;
    const r = await refresh(post(), ctx("p1"));
    expect(r.status).toBe(503);
    expect((await r.json()).error.message).toBe(BACKLINKS_NOT_ENABLED);
    expect(h.calls).toHaveLength(1);
    expect(h.snapshots).toHaveLength(0);
    expect(h.monitors[0].lastError).toBe(BACKLINKS_NOT_ENABLED);
  });

  it("runs a link gap against saved + typed competitors, excluding our own domain", async () => {
    let r = await linkGap(post({ competitors: ["acme.in"] }), ctx("p1"));
    expect(r.status).toBe(400);
    r = await linkGap(post({ competitors: ["https://www.Rival.in/about", "other.com", "rival.in"] }), ctx("p1"));
    expect(r.status).toBe(201);
    const task = (h.calls[0].body as Row[])[0];
    expect(task).toMatchObject({ targets: { "1": "rival.in", "2": "other.com" }, exclude_targets: ["acme.in"], intersection_mode: "partial" });
    const body = await r.json();
    expect(body.item.linkGap.reports[0].items[0]).toEqual({ domain: "pune-directory.in", rank: 33, backlinks: 7, linksTo: ["rival.in", "other.com"] });
    expect(h.usage.filter((u) => u.feature === "link_gap")).toHaveLength(1);
    expect((await linkGap(post({ competitors: ["a.com", "b.com", "c.com", "d.com"] }), ctx("p1"))).status).toBe(400);
  });
});

describe("backlinks service helpers", () => {
  it("cleans competitor lists", () => {
    expect(cleanCompetitors(["Rival.in", "blog.acme.in", "acme.in", "junk", "rival.in"], "acme.in")).toEqual({
      domains: ["rival.in"],
      rejected: ["blog.acme.in", "acme.in", "junk"],
    });
    expect(savedCompetitorDomains([{ domain: "https://www.x.com/" }, { name: "no domain" }, null, { domain: "acme.in" }], "acme.in")).toEqual(["x.com"]);
    expect(linkGapTask("acme.in", ["x.com"]).task.intersection_mode).toBe("all");
    expect(refreshCalls("acme.in", new Date("2026-11-10T00:00:00Z"))[4].task).toMatchObject({ date_to: "2026-11-10", date_from: "2026-08-18", group_range: "week" });
  });

  it("schedules refreshes per plan with failure back-off", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const days = (d: number) => new Date(now.getTime() - d * 86_400_000);
    expect(isRefreshDue({ lastRefreshAt: days(8), lastAttemptAt: null, lastError: null, refreshDays: 7, now })).toBe(true);
    expect(isRefreshDue({ lastRefreshAt: days(3), lastAttemptAt: null, lastError: null, refreshDays: 7, now })).toBe(false);
    expect(isRefreshDue({ lastRefreshAt: days(8), lastAttemptAt: null, lastError: null, refreshDays: 30, now })).toBe(false);
    expect(isRefreshDue({ lastRefreshAt: days(40), lastAttemptAt: null, lastError: null, refreshDays: null, now })).toBe(false);
    expect(isRefreshDue({ lastRefreshAt: days(8), lastAttemptAt: days(0.1), lastError: "x", refreshDays: 7, now })).toBe(false);
  });
});
