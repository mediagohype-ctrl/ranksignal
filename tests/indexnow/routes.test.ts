// Route guards for /api/projects/[id]/indexnow*: roles, tenant scoping, verification before sending.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin" as string,
  site: null as Record<string, unknown> | null,
  queued: [] as unknown[],
  verifyCalls: 0,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org1", role: state.role })) }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: vi.fn(async (t: Record<string, unknown>) => ({ ...t, role: state.role })) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined), auditActorFromSession: () => ({ actorId: "u1", actorType: "user" }) }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn(async () => ({})) }));
vi.mock("@/lib/crawler/safe-fetch", async (orig) => ({
  ...(await orig<typeof import("@/lib/crawler/safe-fetch")>()),
  safeFetch: vi.fn(async (url: string) => {
    state.verifyCalls++;
    return { finalUrl: url, status: 200, headers: new Headers(), body: String(state.site?.key ?? ""), redirectChain: [] };
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; organizationId: string } }) =>
        where.organizationId === "org1" && where.id === "p1" ? { id: "p1", organizationId: "org1", websiteUrl: "https://acme.in" } : null),
    },
    indexNowSite: {
      findFirst: vi.fn(async ({ where }: { where: { organizationId: string } }) => (where.organizationId === "org1" ? state.site : null)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (state.site = { id: "s1", status: "pending", enabled: false, onFixPublished: true, onCrawlChanges: true, ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.site!, data)),
    },
    indexNowSubmission: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: unknown }) => state.queued.push(data)),
    },
    workflowRun: { findFirst: vi.fn(async () => null) },
  },
}));

import { GET, PATCH } from "@/app/api/projects/[id]/indexnow/route";
import { POST as VERIFY } from "@/app/api/projects/[id]/indexnow/verify/route";
import { POST as SUBMIT } from "@/app/api/projects/[id]/indexnow/submit/route";

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const req = (body?: unknown) => new Request("http://localhost/x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  state.role = "admin";
  state.site = null;
  state.queued = [];
  state.verifyCalls = 0;
});

describe("indexnow routes", () => {
  it("viewers can read status without creating anything", async () => {
    state.role = "viewer";
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { item: unknown }).item).toBeNull();
    expect(state.site).toBeNull();
  });
  it("only admins verify; verification enables IndexNow; then members can send pages on the host", async () => {
    state.role = "member";
    expect((await VERIFY(req(), ctx())).status).toBe(403);
    state.role = "admin";
    const v = await VERIFY(req(), ctx());
    expect(((await v.json()) as { item: { ok: boolean } }).item.ok).toBe(true);
    expect(state.site).toMatchObject({ status: "verified", enabled: true, host: "acme.in" });
    state.role = "member";
    const s = await SUBMIT(req({ urls: ["https://acme.in/a", "https://evil.com/b"] }), ctx());
    expect(((await s.json()) as { item: { queued: number } }).item.queued).toBe(1);
    expect(await SUBMIT(req({ urls: ["https://evil.com/b"] }), ctx()).then((r) => r.status)).toBe(400);
  });
  it("refuses to send before verification and is tenant-scoped", async () => {
    state.role = "member";
    expect((await SUBMIT(req({ urls: ["https://acme.in/a"] }), ctx())).status).toBe(409);
    state.role = "admin";
    expect((await VERIFY(req(), ctx("other"))).status).toBe(404);
    expect((await GET(new Request("http://localhost"), ctx("other"))).status).toBe(404);
    expect(state.verifyCalls).toBe(0);
  });
  it("PATCH can't switch IndexNow on without verification; rotating the key turns it off", async () => {
    await VERIFY(req(), ctx());
    const oldKey = state.site!.key;
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ enabled: true }) }), ctx())).status).toBe(400);
    await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ rotateKey: true }) }), ctx());
    expect(state.site).toMatchObject({ enabled: false, status: "pending" });
    expect(state.site!.key).not.toBe(oldKey);
    state.role = "member";
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ onCrawlChanges: false }) }), ctx())).status).toBe(403);
  });
});
