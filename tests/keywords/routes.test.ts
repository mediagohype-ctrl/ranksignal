// Keywords API route guards: tenant scoping (another org's project → 404, every DB read carries organizationId),
// roles (viewers can read but not star), the per-plan star limit, and the CSV export.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Where = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string; readOnly?: boolean },
  stars: [] as { organizationId: string; projectId: string; query: string }[],
  planId: "starter",
  wheres: [] as Where[],
  raw: [] as unknown[],
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/db", () => {
  const projects = [
    { id: "p1", organizationId: "o1", websiteUrl: "https://acme.test/", name: "Acme" },
    { id: "p2", organizationId: "o2", websiteUrl: "https://other.test/", name: "Other" },
  ];
  const match = (row: Record<string, unknown>, where: Where) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  return {
    db: {
      project: { findFirst: async ({ where }: { where: Where }) => projects.find((p) => match(p, where)) ?? null },
      organization: { findUnique: async () => ({ planId: h.planId }) },
      integration: {
        findFirst: async ({ where }: { where: Where }) => {
          h.wheres.push(where);
          return where.organizationId === "o1"
            ? { id: "i1", organizationId: "o1", projectId: "p1", provider: "gsc", credentialEncrypted: "x", config: { siteUrl: "sc-domain:acme.test" }, health: "healthy", lastSyncAt: null }
            : null;
        },
      },
      metricDaily: {
        findFirst: async ({ where }: { where: Where }) => {
          h.wheres.push(where);
          return { date: "2026-11-06" };
        },
        findMany: async ({ where }: { where: Where }) => {
          h.wheres.push(where);
          return [];
        },
      },
      $queryRaw: async (sql: { values?: unknown[] }) => {
        h.raw.push(sql.values);
        return [
          { key: "running shoes", clicks: 10, impressions: 200, posWeighted: 800, posWeight: 200, prevClicks: 5, prevImpressions: 100, prevPosWeighted: 500, prevPosWeight: 100 },
          { key: "=cmd", clicks: 1, impressions: 20, posWeighted: 200, posWeight: 20, prevClicks: 0, prevImpressions: 0, prevPosWeighted: 0, prevPosWeight: 0 },
        ];
      },
      keywordStar: {
        findMany: async ({ where }: { where: Where }) => h.stars.filter((s) => match(s, where)).map((s) => ({ query: s.query })),
        findFirst: async ({ where }: { where: Where }) => h.stars.find((s) => match(s, where)) ?? null,
        count: async ({ where }: { where: Where }) => h.stars.filter((s) => match(s, where)).length,
        create: async ({ data }: { data: { organizationId: string; projectId: string; query: string } }) => {
          h.stars.push(data);
          return data;
        },
        deleteMany: async ({ where }: { where: Where }) => {
          const before = h.stars.length;
          h.stars = h.stars.filter((s) => !match(s, where));
          return { count: before - h.stars.length };
        },
      },
    },
  };
});

import { GET as list } from "@/app/api/projects/[id]/keywords/route";
import { GET as opportunities } from "@/app/api/projects/[id]/keywords/opportunities/route";
import { DELETE as unstar, GET as stars, POST as star } from "@/app/api/projects/[id]/keywords/stars/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, init?: RequestInit) => new Request(`https://app.test${url}`, init);
const post = (body: unknown, method = "POST") =>
  req("/api/projects/p1/keywords/stars", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  h.session = { userId: "u1", email: "a@acme.test", organizationId: "o1", role: "member" };
  h.stars = [];
  h.planId = "starter";
  h.wheres = [];
  h.raw = [];
});

describe("keywords routes", () => {
  it("requires sign-in", async () => {
    h.session = null;
    expect((await list(req("/api/projects/p1/keywords"), ctx("p1"))).status).toBe(401);
  });

  it("404s for another organization's project", async () => {
    expect((await list(req("/api/projects/p2/keywords"), ctx("p2"))).status).toBe(404);
    expect((await star(post({ query: "x" }), ctx("p2"))).status).toBe(404);
  });

  it("lists keywords scoped to the session's organization and project", async () => {
    h.session!.role = "viewer";
    const r = await list(req("/api/projects/p1/keywords?days=7&sort=clicks"), ctx("p1"));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.periods).toMatchObject({ to: "2026-11-06", from: "2026-10-31" });
    expect(j.list.items[0]).toMatchObject({ query: "running shoes", clicks: 10, position: 4, positionChange: -1 });
    for (const w of h.wheres) expect(w.organizationId).toBe("o1");
    expect(h.raw[0]).toEqual(expect.arrayContaining(["o1", "p1"]));
  });

  it("exports CSV with formula-like keywords neutralised", async () => {
    const r = await list(req("/api/projects/p1/keywords?format=csv"), ctx("p1"));
    expect(r.headers.get("content-type")).toMatch(/text\/csv/);
    expect(r.headers.get("content-disposition")).toMatch(/keywords-acme\.test-/);
    const text = await r.text();
    expect(text).toContain("'=cmd");
  });

  it("returns opportunities", async () => {
    const j = await (await opportunities(req("/api/projects/p1/keywords/opportunities?days=28"), ctx("p1"))).json();
    expect(Object.keys(j.groups)).toEqual(["almost_page_1", "low_ctr", "losing_ground", "new_keyword"]);
  });

  it("viewers can read stars but not change them", async () => {
    h.session!.role = "viewer";
    expect((await stars(req("/api/projects/p1/keywords/stars"), ctx("p1"))).status).toBe(200);
    expect((await star(post({ query: "x" }), ctx("p1"))).status).toBe(403);
    expect((await unstar(post({ query: "x" }, "DELETE"), ctx("p1"))).status).toBe(403);
  });

  it("stars within the plan limit (counted per organization) and un-stars", async () => {
    const r = await star(post({ query: "running shoes" }), ctx("p1"));
    expect(r.status).toBe(201);
    expect(h.stars).toEqual([{ organizationId: "o1", projectId: "p1", query: "running shoes", createdById: "u1" }]);
    expect((await star(post({ query: "running shoes" }), ctx("p1"))).status).toBe(200); // idempotent
    h.stars.push(...Array.from({ length: 24 }, (_, i) => ({ organizationId: "o1", projectId: "p9", query: `q${i}` })));
    h.stars.push({ organizationId: "o2", projectId: "p2", query: "not counted" });
    const over = await star(post({ query: "one more" }), ctx("p1"));
    expect(over.status).toBe(403);
    expect((await over.json()).error.code).toBe("star_limit");
    const del = await unstar(post({ query: "running shoes" }, "DELETE"), ctx("p1"));
    expect((await del.json()).removed).toBe(true);
  });
});
