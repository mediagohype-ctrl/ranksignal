// Daily sync with mocked Google APIs and an in-memory DB: backfill window, incremental window, idempotent upserts
// (no duplicate rows), GA4 AI-referrer mapping, and one-time notification on 401/quota.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeState } from "./fake-db";

const h = vi.hoisted(() => ({ state: null as unknown as FakeState }));
vi.mock("@/lib/db", async () => {
  const f = await import("./fake-db");
  h.state = f.newState();
  return { db: f.makeDb(h.state) };
});
vi.mock("@/lib/log", () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }));

import { encryptSecret } from "@/lib/crypto";
import {
  BACKFILL_DAYS, aiReferrerKey, dedupeRows, syncGoogleMetricsDue, syncWindow, topPerDate, type MetricRow,
} from "@/lib/google/sync";

type Body = Record<string, unknown> & { startDate?: string; endDate?: string; dimensions?: unknown[]; dateRanges?: { startDate: string; endDate: string }[] };
let calls: { url: string; body: Body | null; auth: string | null }[] = [];
let tokenStatus = 200;
let queryCount = 3;

const dates = (start: string, end: string) => {
  const out: string[] = [];
  for (let d = Date.parse(`${start}T00:00:00Z`); d <= Date.parse(`${end}T00:00:00Z`); d += 86_400_000) out.push(new Date(d).toISOString().slice(0, 10));
  return out;
};
const g4 = (d: string) => d.replace(/-/g, "");

function mockFetch() {
  calls = [];
  vi.stubGlobal("fetch", async (input: URL | string, init: RequestInit = {}) => {
    const url = String(input);
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = typeof init.body === "string" && init.body.startsWith("{") ? (JSON.parse(init.body) as Body) : null;
    calls.push({ url, body, auth: headers.authorization ?? null });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url === "https://oauth2.googleapis.com/token") {
      return tokenStatus === 200
        ? ok({ access_token: "fresh-access" })
        : new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), { status: 400 });
    }
    if (url.includes("/searchAnalytics/query")) {
      const ds = dates(body!.startDate!, body!.endDate!);
      const dims = body!.dimensions as string[];
      if (dims.length === 1) return ok({ rows: ds.map((d) => ({ keys: [d], clicks: 10, impressions: 100, ctr: 0.1, position: 5 })) });
      return ok({ rows: ds.flatMap((d) => Array.from({ length: queryCount }, (_, i) => ({ keys: [d, `${dims[1]}-${i}`], clicks: i + 1, impressions: 10 * (i + 1), ctr: 0.1, position: 3 }))) });
    }
    if (url.includes(":runReport")) {
      const r = body!.dateRanges![0]!;
      const ds = dates(r.startDate, r.endDate);
      const dim = (body!.dimensions as { name: string }[]).map((x) => x.name);
      if (dim.length === 1) return ok({ rows: ds.map((d) => ({ dimensionValues: [{ value: g4(d) }], metricValues: [{ value: "50" }, { value: "2" }] })) });
      if (dim[1] === "sessionDefaultChannelGroup") {
        return ok({ rows: ds.map((d) => ({ dimensionValues: [{ value: g4(d) }, { value: "Organic Search" }], metricValues: [{ value: "30" }, { value: "1" }] })) });
      }
      // AI referrers: two spellings of ChatGPT on the same day are merged into one row.
      return ok({
        rows: ds.flatMap((d) => [
          { dimensionValues: [{ value: g4(d) }, { value: "chatgpt.com" }], metricValues: [{ value: "3" }, { value: "0" }] },
          { dimensionValues: [{ value: g4(d) }, { value: "www.chatgpt.com" }], metricValues: [{ value: "1" }, { value: "0" }] },
          { dimensionValues: [{ value: g4(d) }, { value: "perplexity.ai" }], metricValues: [{ value: "2" }, { value: "0" }] },
        ]),
      });
    }
    return new Response("{}", { status: 404 });
  });
}

function addIntegration(provider: "gsc" | "ga4", config: Record<string, unknown>) {
  h.state.integrations.push({
    id: `i-${provider}`, organizationId: "o1", projectId: "p1", provider, health: "healthy",
    credentialEncrypted: encryptSecret(JSON.stringify({ refresh_token: "rt" })), config, lastSyncAt: null, createdAt: new Date(),
  });
}

const NOW = new Date("2026-10-29T06:00:00Z");

beforeEach(async () => {
  const f = await import("./fake-db");
  Object.assign(h.state, f.newState());
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
  vi.stubEnv("CREDENTIALS_KEY", "b".repeat(64));
  tokenStatus = 200;
  queryCount = 3;
  mockFetch();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const uniq = (rows: Record<string, unknown>[]) => new Set(rows.map((r) => [r.projectId, r.source, r.date, r.dimension, r.key].join("|"))).size;

describe("sync windows and helpers", () => {
  it("backfills 90 days first, then the last 3 finished days", () => {
    expect(syncWindow(NOW, false)).toEqual({ startDate: "2026-07-31", endDate: "2026-10-28" });
    expect(dates("2026-07-31", "2026-10-28")).toHaveLength(BACKFILL_DAYS);
    expect(syncWindow(NOW, true)).toEqual({ startDate: "2026-10-26", endDate: "2026-10-28" });
  });

  it("keeps the top N per day and merges duplicate keys", () => {
    const rows: MetricRow[] = [5, 1, 9, 3].map((c, i) => ({ date: "2026-10-01", dimension: "query", key: `q${i}`, clicks: c, impressions: 1 }));
    expect(topPerDate(rows, 2).map((r) => r.key)).toEqual(["q2", "q0"]);
    const d = dedupeRows([
      { date: "2026-10-01", dimension: "ai_referrer", key: "chatgpt.com", sessions: 2 },
      { date: "2026-10-01", dimension: "ai_referrer", key: "chatgpt.com", sessions: 3 },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]!.sessions).toBe(5);
  });

  it("recognises AI assistant referrers only", () => {
    expect(aiReferrerKey("chatgpt.com")).toBe("chatgpt.com");
    expect(aiReferrerKey("WWW.Perplexity.AI")).toBe("perplexity.ai");
    expect(aiReferrerKey("gemini.google.com")).toBe("gemini.google.com");
    expect(aiReferrerKey("google")).toBeNull();
    expect(aiReferrerKey("notchatgpt.com")).toBeNull();
  });
});

describe("syncGoogleMetricsDue", () => {
  it("does nothing when Google isn't configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    addIntegration("gsc", { googleEmail: "a@b.c", siteUrl: "sc-domain:acme.test" });
    expect(await syncGoogleMetricsDue(NOW)).toEqual({ synced: 0, failed: 0, skipped: 0 });
    expect(calls).toHaveLength(0);
  });

  it("skips integrations with no chosen property", async () => {
    addIntegration("gsc", { googleEmail: "a@b.c" });
    await syncGoogleMetricsDue(NOW);
    expect(calls).toHaveLength(0);
  });

  it("backfills GSC, then re-syncs recent days idempotently without duplicates", async () => {
    addIntegration("gsc", { googleEmail: "a@b.c", siteUrl: "sc-domain:acme.test" });
    expect(await syncGoogleMetricsDue(NOW)).toMatchObject({ synced: 1 });

    const q = calls.filter((c) => c.url.includes("searchAnalytics"));
    expect(q[0]!.url).toContain(encodeURIComponent("sc-domain:acme.test"));
    expect(q.every((c) => c.body!.startDate === "2026-07-31" && c.body!.endDate === "2026-10-28")).toBe(true);
    expect(q.every((c) => c.auth === "Bearer fresh-access")).toBe(true);
    const totals = h.state.metrics.filter((m) => m.dimension === "total");
    expect(totals).toHaveLength(90);
    expect(h.state.metrics.filter((m) => m.dimension === "query")).toHaveLength(90 * 3);
    expect(h.state.metrics.filter((m) => m.dimension === "page")).toHaveLength(90 * 3);
    const row = h.state.integrations[0]!;
    expect(row.lastSyncAt).toEqual(NOW);
    expect(row.health).toBe("healthy");
    expect((row.config as { sync: { backfilledAt: string } }).sync.backfilledAt).toBe(NOW.toISOString());

    // Not due again within 20h.
    calls = [];
    await syncGoogleMetricsDue(new Date(NOW.getTime() + 10 * 3_600_000));
    expect(calls).toHaveLength(0);

    // Next day: only 3 days are fetched; a query that dropped out of the top list is removed for those days.
    queryCount = 2;
    calls = [];
    const later = new Date(NOW.getTime() + 24 * 3_600_000);
    await syncGoogleMetricsDue(later);
    const q2 = calls.filter((c) => c.url.includes("searchAnalytics"));
    expect(q2.every((c) => c.body!.startDate === "2026-10-27" && c.body!.endDate === "2026-10-29")).toBe(true);
    expect(h.state.metrics.filter((m) => m.dimension === "total")).toHaveLength(91);
    expect(uniq(h.state.metrics)).toBe(h.state.metrics.length);
    const recentQueries = h.state.metrics.filter((m) => m.dimension === "query" && (m.date as string) >= "2026-10-27");
    expect(recentQueries).toHaveLength(3 * 2);
  });

  it("stores GA4 sessions, channels and merged AI-referrer sessions", async () => {
    addIntegration("ga4", { googleEmail: "a@b.c", propertyId: "properties/123" });
    await syncGoogleMetricsDue(NOW);
    expect(calls.some((c) => c.url === "https://analyticsdata.googleapis.com/v1beta/properties/123:runReport")).toBe(true);
    const day = h.state.metrics.filter((m) => m.date === "2026-10-28");
    expect(day.find((m) => m.dimension === "total")).toMatchObject({ source: "ga4", sessions: 50, conversions: 2 });
    expect(day.find((m) => m.dimension === "channel")).toMatchObject({ key: "Organic Search", sessions: 30 });
    expect(day.find((m) => m.dimension === "ai_referrer" && m.key === "chatgpt.com")).toMatchObject({ sessions: 4 });
    expect(day.find((m) => m.dimension === "ai_referrer" && m.key === "perplexity.ai")).toMatchObject({ sessions: 2 });
    expect(uniq(h.state.metrics)).toBe(h.state.metrics.length);
  });

  it("marks the integration degraded on 401/invalid_grant and notifies only once", async () => {
    tokenStatus = 400;
    addIntegration("gsc", { googleEmail: "a@b.c", siteUrl: "sc-domain:acme.test" });
    expect(await syncGoogleMetricsDue(NOW)).toMatchObject({ failed: 1 });
    const row = h.state.integrations[0]!;
    expect(row.health).toBe("degraded");
    expect(row.lastSyncAt).toBeNull();
    expect((row.config as { sync: { lastError: string } }).sync.lastError).toMatch(/Reconnect/);
    expect(h.state.notifications).toHaveLength(1);
    expect(h.state.notifications[0]).toMatchObject({ organizationId: "o1", type: "integration_degraded", link: "/app/projects/p1/integrations" });
    expect(h.state.metrics).toHaveLength(0);

    // Backoff: not retried within 6h.
    calls = [];
    await syncGoogleMetricsDue(new Date(NOW.getTime() + 2 * 3_600_000));
    expect(calls).toHaveLength(0);
    // Retried later, still failing: no second notification.
    await syncGoogleMetricsDue(new Date(NOW.getTime() + 7 * 3_600_000));
    expect(calls.length).toBeGreaterThan(0);
    expect(h.state.notifications).toHaveLength(1);

    // Recovery clears the error and re-arms the notification.
    tokenStatus = 200;
    await syncGoogleMetricsDue(new Date(NOW.getTime() + 14 * 3_600_000));
    expect(row.health).toBe("healthy");
    expect((row.config as { sync: { lastError: string | null; notifiedAt: string | null } }).sync).toMatchObject({ lastError: null, notifiedAt: null });
  });

  it("handles quota errors gracefully", async () => {
    addIntegration("gsc", { googleEmail: "a@b.c", siteUrl: "sc-domain:acme.test" });
    vi.stubGlobal("fetch", async (input: URL | string) => {
      const url = String(input);
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "x" }), { status: 200 });
      return new Response(JSON.stringify({ error: { code: 429, message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" } }), { status: 429 });
    });
    expect(await syncGoogleMetricsDue(NOW)).toMatchObject({ failed: 1 });
    expect(h.state.integrations[0]!.health).toBe("degraded");
    expect(h.state.notifications[0]!.body).toMatch(/limit/);
  });
});
