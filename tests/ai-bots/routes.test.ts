// Route guards for AI bot analytics: token auth on ingest (a token only writes to its own project), plan gating,
// rate limiting, body caps; roles + tenant scoping on token management and uploads.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashIngestToken } from "@/lib/ai-bots-analytics/ingest";

const TOKEN = "mwr_bot_abcdefghijklmnopqrstuvwxyz012345";
const state = vi.hoisted(() => ({
  role: "admin" as string,
  planId: "starter",
  ingested: [] as unknown[],
  keys: [] as Record<string, unknown>[],
  imports: 0,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org1", role: state.role })) }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: vi.fn(async (t: Record<string, unknown>) => ({ ...t, role: state.role })) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined), auditActorFromSession: () => ({ actorId: "u1", actorType: "user" }) }));
vi.mock("@/lib/billing/access", () => ({ getOrgAccess: vi.fn(async () => ({ active: true, planId: state.planId })) }));
vi.mock("@/lib/ai-bots-analytics/ranges", () => ({ loadRangeChecker: vi.fn(async () => ({ check: () => "claimed", loaded: () => [] })) }));
vi.mock("@/lib/ai-bots-analytics/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-bots-analytics/store")>()),
  persistAggregates: vi.fn(async (scope: unknown, agg: { botHits: number }) => {
    state.ingested.push({ scope, botHits: agg.botHits });
    return null;
  }),
  uploadsToday: vi.fn(async () => state.imports),
}));
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; organizationId: string } }) =>
        where.organizationId === "org1" && where.id === "p1" ? { id: "p1", organizationId: "org1", websiteUrl: "https://acme.in" } : null),
    },
    organization: { findUnique: vi.fn(async () => ({ planId: state.planId })) },
    aiBotIngestKey: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => state.keys.find((k) => k.tokenHash === where.tokenHash) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string; projectId: string } }) =>
        state.keys.find((k) => k.organizationId === where.organizationId && k.projectId === where.projectId) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.keys.push({ id: "k1", ...data })),
      update: vi.fn(async () => undefined),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

import { POST as INGEST } from "@/app/api/projects/[id]/ai-bots/ingest/route";
import { POST as TOKEN_POST, DELETE as TOKEN_DELETE } from "@/app/api/projects/[id]/ai-bots/token/route";
import { POST as UPLOAD } from "@/app/api/projects/[id]/ai-bots/upload/route";

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const ingest = (body: unknown, token: string | null = TOKEN, id = "p1") =>
  INGEST(
    new Request(`http://localhost/api/projects/${id}/ai-bots/ingest`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(id),
  );
const event = { ip: "1.1.1.1", path: "/a", status: 200, userAgent: "GPTBot/1.2", time: "2026-11-01T00:00:00Z" };

beforeEach(() => {
  state.role = "admin";
  state.planId = "starter";
  state.ingested = [];
  state.imports = 0;
  state.keys = [{ id: "k1", organizationId: "org1", projectId: "p1", tokenHash: hashIngestToken(TOKEN), lastUsedAt: null }];
});

describe("POST /ai-bots/ingest", () => {
  it("accepts a valid token for its own project and counts only crawler hits", async () => {
    const res = await ingest({ events: [event, { ...event, userAgent: "Chrome" }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, received: 2, counted: 1 });
    expect(state.ingested).toEqual([{ scope: { organizationId: "org1", projectId: "p1" }, botHits: 1 }]);
  });
  it("rejects missing, wrong or other-project tokens", async () => {
    expect((await ingest({ events: [event] }, null)).status).toBe(401);
    expect((await ingest({ events: [event] }, "mwr_bot_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).status).toBe(401);
    expect((await ingest({ events: [event] }, TOKEN, "p2")).status).toBe(401);
    expect(state.ingested).toEqual([]);
  });
  it("is gated by plan and validates the body", async () => {
    state.planId = "trial";
    expect((await ingest({ events: [event] })).status).toBe(402);
    state.planId = "starter";
    expect((await ingest("not json")).status).toBe(400);
    expect((await ingest({ events: new Array(1001).fill(event) })).status).toBe(400);
    expect((await ingest({ lines: ["x".repeat(1024 * 1024 + 10)] })).status).toBe(413);
  });
  it("rate-limits per project", async () => {
    state.keys[0].projectId = "p-rl";
    let last = 0;
    for (let i = 0; i < 301; i++) last = (await ingest({ events: [] }, TOKEN, "p-rl")).status;
    expect(last).toBe(429);
  });
});

describe("token management", () => {
  it("needs admin and a plan with live logging; shows the token once and stores only a hash", async () => {
    state.role = "member";
    expect((await TOKEN_POST(new Request("http://localhost"), ctx())).status).toBe(403);
    state.role = "admin";
    state.keys = [];
    const res = await TOKEN_POST(new Request("http://localhost"), ctx());
    const body = (await res.json()) as { item: { token: string } };
    expect(body.item.token).toMatch(/^mwr_bot_/);
    expect(JSON.stringify(state.keys)).not.toContain(body.item.token);
    expect(state.keys[0].tokenHash).toBe(hashIngestToken(body.item.token));
    state.planId = "trial";
    expect((await TOKEN_POST(new Request("http://localhost"), ctx())).status).toBe(402);
  });
  it("is tenant-scoped", async () => {
    expect((await TOKEN_POST(new Request("http://localhost"), ctx("other"))).status).toBe(404);
    expect((await TOKEN_DELETE(new Request("http://localhost"), ctx("other"))).status).toBe(404);
  });
});

describe("POST /ai-bots/upload", () => {
  const upload = (body: string, headers: Record<string, string> = {}, id = "p1") =>
    UPLOAD(new Request(`http://localhost/api/projects/${id}/ai-bots/upload`, { method: "POST", body, headers }), ctx(id));
  const log = '20.1.1.1 - - [01/Nov/2026:00:00:00 +0000] "GET /x HTTP/1.1" 200 1 "-" "GPTBot/1.2"\n';

  it("parses the streamed body for members", async () => {
    state.role = "member";
    const res = await upload(log + log);
    expect(res.status).toBe(200);
    const { item } = (await res.json()) as { item: { botHits: number; linesTotal: number } };
    expect(item).toMatchObject({ botHits: 2 });
  });
  it("refuses viewers, other tenants, oversized declarations and the daily cap", async () => {
    state.role = "viewer";
    expect((await upload(log)).status).toBe(403);
    state.role = "member";
    expect((await upload(log, {}, "nope")).status).toBe(404);
    expect((await upload(log, { "content-length": String(60 * 1024 * 1024) })).status).toBe(413);
    state.imports = 99;
    expect((await upload(log)).status).toBe(429);
  });
});
