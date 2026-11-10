// Public API v1 route guards: API-key auth, tenant scoping by the key's organization, rate limits, envelope, ETags.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  apiKey: { findUnique: vi.fn(), update: vi.fn() },
  project: { findMany: vi.fn(), findFirst: vi.fn() },
  reportSnapshot: { findMany: vi.fn() },
  crawlRun: { findFirst: vi.fn() },
  visibilityRun: { findFirst: vi.fn() },
  observation: { findMany: vi.fn() },
  metricDaily: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
const stored = vi.hoisted(() => ({ getStoredReport: vi.fn() }));
vi.mock("@/lib/report/stored", () => stored);

import { generateApiKey, hashApiKey } from "@/lib/api-keys/keys";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import { GET as listProjects } from "@/app/api/v1/projects/route";
import { GET as getProject } from "@/app/api/v1/projects/[id]/route";
import { GET as getReport } from "@/app/api/v1/projects/[id]/report/route";
import { GET as getIssues } from "@/app/api/v1/projects/[id]/issues/route";
import { GET as getLooker } from "@/app/api/v1/projects/[id]/looker/route";
import { GET as openapi } from "@/app/api/v1/openapi.json/route";

let seq = 0;
interface KeyRow { id: string; organizationId: string; scopes: string[]; revokedAt: Date | null; lastUsedAt: Date | null; organization: { planId: string; status: string } }
const keys = new Map<string, KeyRow>();

function makeKey(o: Partial<KeyRow> = {}) {
  const g = generateApiKey();
  const row: KeyRow = { id: `key${++seq}`, organizationId: "orgA", scopes: ["read"], revokedAt: null, lastUsedAt: new Date(), organization: { planId: "growth", status: "active" }, ...o };
  keys.set(g.hash, row);
  return { key: g.key, row };
}

const req = (path: string, key?: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), "x-real-ip": `10.0.0.${seq % 250}`, ...headers } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const REPORT = {
  projectId: "p1",
  generatedAt: "2026-11-01T00:00:00.000Z",
  overall: { score: 70, grade: "C", headline: "" },
  pillars: [],
  issues: [
    { id: "i1", pillar: "seo", impact: "high", effort: "quick", title: "a" },
    { id: "i2", pillar: "aeo", impact: "low", effort: "quick", title: "b" },
    { id: "i3", pillar: "seo", impact: "medium", effort: "quick", title: "c" },
  ],
  crawl: {},
  aiVisibility: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  keys.clear();
  mockDb.apiKey.findUnique.mockImplementation(async ({ where }: { where: { keyHash: string } }) => keys.get(where.keyHash) ?? null);
  mockDb.apiKey.update.mockResolvedValue({});
  mockDb.project.findFirst.mockImplementation(async ({ where }: { where: { id: string; organizationId: string } }) =>
    where.id === "p1" && where.organizationId === "orgA" ? { id: "p1", name: "Acme", websiteUrl: "https://acme.test", createdAt: new Date("2026-01-01"), brandNames: ["Acme"], competitors: [{ name: "Rival", domain: "rival.test" }] } : null,
  );
  mockDb.project.findMany.mockResolvedValue([]);
  mockDb.reportSnapshot.findMany.mockResolvedValue([]);
  mockDb.crawlRun.findFirst.mockResolvedValue(null);
  mockDb.visibilityRun.findFirst.mockResolvedValue(null);
  mockDb.metricDaily.findMany.mockResolvedValue([]);
  stored.getStoredReport.mockResolvedValue(REPORT);
});

/** Next.js always passes a route context; routes without dynamic segments get empty params. */
const NO_PARAMS = { params: Promise.resolve({}) };

describe("authentication", () => {
  it("401 without a key, with WWW-Authenticate, and never touches project data", async () => {
    const res = await listProjects(req("/api/v1/projects"), NO_PARAMS);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer/);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.requestId).toBeTruthy();
    expect(mockDb.project.findMany).not.toHaveBeenCalled();
  });

  it("401 invalid_api_key for unknown, malformed and revoked keys", async () => {
    const unknown = generateApiKey().key;
    const { key: revoked } = makeKey({ revokedAt: new Date() });
    for (const k of [unknown, "mwr_nope", revoked]) {
      const res = await listProjects(req("/api/v1/projects", k), NO_PARAMS);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("invalid_api_key");
    }
    expect(mockDb.project.findMany).not.toHaveBeenCalled();
  });

  it("looks keys up by SHA-256 hash only", async () => {
    const { key } = makeKey();
    await listProjects(req("/api/v1/projects", key), NO_PARAMS);
    expect(mockDb.apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash: hashApiKey(key) } }));
  });

  it("403 org_suspended for a suspended workspace", async () => {
    const { key } = makeKey({ organization: { planId: "growth", status: "suspended" } });
    const res = await listProjects(req("/api/v1/projects", key), NO_PARAMS);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("org_suspended");
  });

  it("403 for a key without the read scope", async () => {
    const { key } = makeKey({ scopes: [] });
    expect((await listProjects(req("/api/v1/projects", key), NO_PARAMS)).status).toBe(403);
  });
});

describe("tenant scoping", () => {
  it("lists only the key's organization's projects", async () => {
    const { key } = makeKey({ organizationId: "orgB" });
    const res = await listProjects(req("/api/v1/projects", key), NO_PARAMS);
    expect(res.status).toBe(200);
    expect(mockDb.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "orgB" }) }));
    expect(await res.json()).toEqual({ data: [], meta: { nextCursor: null } });
  });

  it("404 for another organization's project id, on every project route", async () => {
    const { key } = makeKey({ organizationId: "orgB" });
    for (const [route, path] of [
      [getProject, "/api/v1/projects/p1"],
      [getReport, "/api/v1/projects/p1/report"],
      [getIssues, "/api/v1/projects/p1/issues"],
      [getLooker, "/api/v1/projects/p1/looker"],
    ] as const) {
      const res = await route(req(path, key), params("p1"));
      expect(res.status, path).toBe(404);
      expect((await res.json()).error.code).toBe("not_found");
    }
    expect(stored.getStoredReport).not.toHaveBeenCalled();
  });

  it("serves the project to its own organization", async () => {
    const { key } = makeKey();
    const res = await getProject(req("/api/v1/projects/p1", key), params("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ id: "p1", brandNames: ["Acme"], competitors: [{ name: "Rival", domain: "rival.test" }], latest: null });
  });
});

describe("issues, paging and caching", () => {
  it("filters and pages issues with an opaque cursor", async () => {
    const { key } = makeKey();
    const first = await (await getIssues(req("/api/v1/projects/p1/issues?pillar=seo&limit=1", key), params("p1"))).json();
    expect(first.data.map((i: { id: string }) => i.id)).toEqual(["i1"]);
    expect(first.meta.total).toBe(2);
    expect(first.meta.nextCursor).toBeTruthy();
    const second = await (await getIssues(req(`/api/v1/projects/p1/issues?pillar=seo&limit=1&cursor=${first.meta.nextCursor}`, key), params("p1"))).json();
    expect(second.data.map((i: { id: string }) => i.id)).toEqual(["i3"]);
    expect(second.meta.nextCursor).toBeNull();
  });

  it("400 for bad query parameters", async () => {
    const { key } = makeKey();
    const res = await getIssues(req("/api/v1/projects/p1/issues?impact=huge", key), params("p1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("404 report_not_available before the first check", async () => {
    stored.getStoredReport.mockResolvedValue(null);
    const { key } = makeKey();
    const res = await getReport(req("/api/v1/projects/p1/report", key), params("p1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("report_not_available");
  });

  it("returns an ETag and 304 when it matches", async () => {
    const { key } = makeKey();
    const res = await getReport(req("/api/v1/projects/p1/report", key), params("p1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
    const etag = res.headers.get("etag")!;
    expect(etag).toMatch(/^W\//);
    const again = await getReport(req("/api/v1/projects/p1/report", key, { "if-none-match": etag }), params("p1"));
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
  });

  it("returns daily Looker rows with field metadata", async () => {
    const { key } = makeKey();
    const res = await getLooker(req("/api/v1/projects/p1/looker?from=2026-10-01&to=2026-10-03", key), params("p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((r: { date: string }) => r.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(body.meta.fields.length).toBeGreaterThan(5);
    expect(mockDb.metricDaily.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "orgA", projectId: "p1" }) }));
  });
});

describe("rate limits", () => {
  it("429 after the per-minute limit, with Retry-After and rate headers", async () => {
    const { key, row } = makeKey({ organization: { planId: "starter", status: "active" } });
    resetRateLimit(`api:min:${row.id}`);
    let last: Response | null = null;
    for (let i = 0; i < 61; i++) last = await listProjects(req("/api/v1/projects", key), NO_PARAMS);
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBeTruthy();
    expect(last!.headers.get("x-ratelimit-limit")).toBe("60");
    expect((await last!.json()).error.code).toBe("rate_limited");
  });

  it("429 daily_limit_reached when the organization's daily cap is used up", async () => {
    const day = new Date().toISOString().slice(0, 10);
    const org = `orgDaily${seq}`;
    resetRateLimit(`api:day:${org}:${day}`);
    let last: Response | null = null;
    // Trial: 500 a day. Spread over keys so the per-minute limit doesn't trigger first.
    for (let i = 0; i < 501; i++) {
      const { key } = makeKey({ organizationId: org, organization: { planId: "trial", status: "active" } });
      last = await listProjects(req("/api/v1/projects", key), NO_PARAMS);
    }
    expect(last!.status).toBe(429);
    expect((await last!.json()).error.code).toBe("daily_limit_reached");
  });
});

describe("OpenAPI", () => {
  it("is served without a key", async () => {
    const res = openapi();
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.components.securitySchemes.apiKey.scheme).toBe("bearer");
  });
});
