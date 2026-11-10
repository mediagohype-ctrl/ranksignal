// Business Profile API guards: 501 without GOOGLE_PLACES_API_KEY, roles (search/pick = admin, refresh = member),
// tenant scoping, Places calls only to places.googleapis.com with a field mask and the key in a header (never in the
// URL or response), and the 24h manual-refresh limit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Where = Record<string, unknown>;
const h = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; organizationId: string; role: string },
  profiles: [] as Record<string, unknown>[],
  snapshots: [] as Record<string, unknown>[],
  calls: [] as { url: string; opts: Record<string, unknown> }[],
}));

vi.mock("@/lib/auth/session", () => ({ getSession: async () => h.session }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: unknown) => t }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: async () => undefined, auditActorFromSession: (s: { userId: string }) => ({ actorId: s.userId, actorType: "user" }) }));
vi.mock("@/lib/net/safe-request", () => ({
  safeRequestJson: async (url: string, opts: Record<string, unknown>) => {
    h.calls.push({ url, opts });
    if (url.includes(":searchText")) {
      return { ok: true, status: 200, data: { places: [{ id: "ChIJabcdefghijk", displayName: { text: "Acme Store" }, formattedAddress: "Pune 411001" }] } };
    }
    return { ok: true, status: 200, data: { id: "ChIJabcdefghijk", displayName: { text: "Acme Store" }, rating: 4.2, userRatingCount: 12, businessStatus: "OPERATIONAL" } };
  },
}));
vi.mock("@/lib/db", () => {
  const projects = [
    { id: "p1", organizationId: "o1", websiteUrl: "https://acme.test/", name: "Acme" },
    { id: "p2", organizationId: "o2", websiteUrl: "https://other.test/", name: "Other" },
  ];
  const match = (row: Record<string, unknown>, where: Where) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));
  let n = 0;
  const db = {
    project: { findFirst: async ({ where }: { where: Where }) => projects.find((p) => match(p, where)) ?? null },
    organization: { findUnique: async () => ({ planId: "growth" }) },
    businessProfile: {
      findFirst: async ({ where }: { where: Where }) => h.profiles.find((p) => match(p, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `bp${++n}`, lastSnapshotAt: null, lastAttemptAt: null, lastError: null, ...data };
        h.profiles.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = h.profiles.find((p) => p.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: { where: Where }) => {
        const before = h.profiles.length;
        h.profiles = h.profiles.filter((p) => !match(p, where));
        return { count: before - h.profiles.length };
      },
    },
    businessProfileSnapshot: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        h.snapshots.push(data);
        return data;
      },
      findMany: async ({ where }: { where: Where }) => h.snapshots.filter((s) => match(s, where)).reverse(),
    },
    crawlRun: { findFirst: async () => null },
    crawlPage: { findMany: async () => [] },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { db };
});

import { DELETE as remove, GET as view, POST as pick } from "@/app/api/projects/[id]/business-profile/route";
import { POST as search } from "@/app/api/projects/[id]/business-profile/search/route";
import { POST as refresh } from "@/app/api/projects/[id]/business-profile/refresh/route";

const KEY = "AIza-TEST-KEY-never-leaks";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const jreq = (body?: unknown) =>
  new Request("https://app.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);
  h.session = { userId: "u1", email: "a@acme.test", organizationId: "o1", role: "admin" };
  h.profiles = [];
  h.snapshots = [];
  h.calls = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("business profile routes", () => {
  it("answers 501 with setup help when the Places key is missing", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const r = await search(jreq({ query: "acme store pune" }), ctx("p1"));
    expect(r.status).toBe(501);
    expect((await r.json()).error.message).toMatch(/GOOGLE_PLACES_API_KEY/);
    const v = await (await view(new Request("https://app.test/x"), ctx("p1"))).json();
    expect(v.item.configured).toBe(false);
  });

  it("only admins can search and pick; other orgs' projects are 404", async () => {
    h.session!.role = "member";
    expect((await search(jreq({ query: "acme" }), ctx("p1"))).status).toBe(403);
    expect((await pick(jreq({ placeId: "ChIJabcdefghijk" }), ctx("p1"))).status).toBe(403);
    expect((await remove(new Request("https://app.test/x", { method: "DELETE" }), ctx("p1"))).status).toBe(403);
    h.session!.role = "admin";
    expect((await search(jreq({ query: "acme" }), ctx("p2"))).status).toBe(404);
    expect((await pick(jreq({ placeId: "ChIJabcdefghijk" }), ctx("p2"))).status).toBe(404);
  });

  it("searches Places with a field mask and the key in a header only", async () => {
    const r = await search(jreq({ query: "acme store pune" }), ctx("p1"));
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).not.toContain(KEY);
    expect(JSON.parse(body).items).toEqual([{ placeId: "ChIJabcdefghijk", name: "Acme Store", address: "Pune 411001" }]);
    const c = h.calls[0];
    expect(c.url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(c.url).not.toContain(KEY);
    expect(c.opts.allowedHosts).toEqual(["places.googleapis.com"]);
    expect((c.opts.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress");
    expect((c.opts.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(KEY);
  });

  it("rejects malformed place ids", async () => {
    expect((await pick(jreq({ placeId: "../../etc" }), ctx("p1"))).status).toBe(400);
  });

  it("picks a business, stores a snapshot scoped to the org, and limits manual refresh", async () => {
    const r = await pick(jreq({ placeId: "ChIJabcdefghijk" }), ctx("p1"));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.item.profile).toMatchObject({ placeId: "ChIJabcdefghijk", name: "Acme Store", refreshDays: 7 });
    expect(j.item.latest).toMatchObject({ rating: 4.2, reviewCount: 12 });
    expect(h.profiles[0]).toMatchObject({ organizationId: "o1", projectId: "p1" });
    expect(h.snapshots[0]).toMatchObject({ organizationId: "o1", trigger: "select" });
    const details = h.calls.find((c) => c.url.includes("/v1/places/ChIJabcdefghijk"))!;
    expect((details.opts.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain("userRatingCount");

    h.session!.role = "member";
    const again = await refresh(jreq(), ctx("p1"));
    expect(again.status).toBe(429);
    h.profiles[0].lastSnapshotAt = new Date(Date.now() - 25 * 3_600_000);
    expect((await refresh(jreq(), ctx("p1"))).status).toBe(200);
    expect(h.snapshots).toHaveLength(2);

    h.session!.role = "viewer";
    expect((await refresh(jreq(), ctx("p1"))).status).toBe(403);
  });

  it("another org cannot see this org's profile", async () => {
    await pick(jreq({ placeId: "ChIJabcdefghijk" }), ctx("p1"));
    h.session = { userId: "u2", email: "b@other.test", organizationId: "o2", role: "owner" };
    expect((await view(new Request("https://app.test/x"), ctx("p1"))).status).toBe(404);
    const own = await (await view(new Request("https://app.test/x"), ctx("p2"))).json();
    expect(own.item.profile).toBeNull();
  });
});
