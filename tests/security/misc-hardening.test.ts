import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";

const h = vi.hoisted(() => ({
  users: new Map<string, { emailVerified: boolean; passwordHash: string }>(),
  cookies: [] as { name: string; value: string; opts: { maxAge: number } }[],
  budget: vi.fn(async () => undefined),
  spend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async (a: { where: { id: string } }) => h.users.get(a.where.id) ?? null,
    },
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, opts: { maxAge: number }) => void h.cookies.push({ name, value, opts }),
    get: () => undefined,
    delete: () => undefined,
  }),
}));
vi.mock("@/lib/billing/ai-budget", () => ({ assertAiBudget: h.budget, noteAiSpend: h.spend }));

import { assertCanSendInvites, INVITES_PER_USER_PER_DAY } from "@/lib/auth/invite";
import { setSessionCookie } from "@/lib/auth/session";
import { auditActorFromSession } from "@/lib/audit-log";
import { dataForSeoVisibilityProvider } from "@/lib/providers/visibility/dataforseo";
import { createNeedsAdmin, projectCreateSchema } from "@/lib/dashboard/project-schema";
import { JobError } from "@/lib/types";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-0123456789";
});
beforeEach(() => {
  h.users.clear();
  h.cookies.length = 0;
  h.budget.mockReset();
  h.budget.mockResolvedValue(undefined);
  h.spend.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("invite anti-phishing", () => {
  it("requires the inviter's email to be verified", async () => {
    h.users.set("unverified", { emailVerified: false, passwordHash: "$2b$x" });
    await expect(assertCanSendInvites("unverified")).rejects.toMatchObject({ status: 403, code: "email_unverified" });
  });

  it(`caps each user at ${INVITES_PER_USER_PER_DAY} invitations per day, across workspaces`, async () => {
    h.users.set("inviter", { emailVerified: true, passwordHash: "$2b$x" });
    const t0 = Date.now();
    for (let i = 0; i < INVITES_PER_USER_PER_DAY; i++) await assertCanSendInvites("inviter", t0);
    await expect(assertCanSendInvites("inviter", t0)).rejects.toMatchObject({ status: 429 });
    await expect(assertCanSendInvites("inviter", t0 + 24 * 60 * 60 * 1000 + 1)).resolves.toBeUndefined();
  });
});

describe("staff attribution + short support sessions", () => {
  it("auditActorFromSession marks support-mode sessions as staff", () => {
    expect(auditActorFromSession({ userId: "u1" })).toEqual({ actorId: "u1", actorType: "user" });
    expect(auditActorFromSession({ userId: "s1", staffMode: true })).toEqual({ actorId: "s1", actorType: "staff" });
  });

  it("setSessionCookie supports a shorter TTL (support mode: 2h) and never exceeds 7 days", async () => {
    h.users.set("s1", { emailVerified: true, passwordHash: "$2b$12$abc" });
    const ctx = { userId: "s1", email: "s@x.io", organizationId: "o1", role: "admin" as const, staffMode: true };
    await setSessionCookie(ctx, { maxAgeSeconds: 2 * 60 * 60 });
    expect(h.cookies[0].opts.maxAge).toBe(7200);
    const p = decodeJwt(h.cookies[0].value);
    expect(p.exp! - p.iat!).toBe(7200);
    await setSessionCookie(ctx, { maxAgeSeconds: 365 * 24 * 3600 });
    expect(h.cookies[1].opts.maxAge).toBe(7 * 24 * 3600);
    await setSessionCookie(ctx);
    expect(h.cookies[2].opts.maxAge).toBe(7 * 24 * 3600);
  });
});

describe("DataForSEO AI budget", () => {
  const query = { text: "best widgets", locale: "en-IN" } as never;

  it("checks the budget before calling and records spend after", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "l");
    vi.stubEnv("DATAFORSEO_PASSWORD", "p");
    const order: string[] = [];
    h.budget.mockImplementation(async () => void order.push("budget"));
    vi.stubGlobal("fetch", vi.fn(async () => {
      order.push("fetch");
      return new Response(JSON.stringify({ cost: 0.002, tasks: [{ status_code: 20000, result: [{ items: [{ text: "An answer" }] }] }] }), { status: 200 });
    }));
    const ans = await dataForSeoVisibilityProvider.run(query);
    expect(order).toEqual(["budget", "fetch"]);
    expect(h.spend).toHaveBeenCalledWith(2000);
    expect(ans.costMicros).toBe(2000);
  });

  it("does not call the API when the budget is exhausted", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "l");
    vi.stubEnv("DATAFORSEO_PASSWORD", "p");
    h.budget.mockRejectedValue(new JobError("AI budget reached", "quota"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(dataForSeoVisibilityProvider.run(query)).rejects.toMatchObject({ errorClass: "quota" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("project create mass assignment", () => {
  const base = { name: "A", websiteUrl: "https://a.com", brandNames: ["A"] };

  it("rejects unknown settings keys on create", () => {
    expect(() => projectCreateSchema.parse({ ...base, settings: { keyPages: ["/"] } })).toThrow();
    expect(() => projectCreateSchema.parse({ ...base, settings: { businessFacts: ["We are #1"] } })).toThrow();
    expect(() => projectCreateSchema.parse({ ...base, settings: { automation: { allowClassB: [], extra: 1 } } })).toThrow();
    const ok = projectCreateSchema.parse({ ...base, settings: { maxPagesPerCrawl: 10, automation: { allowClassB: [] }, share: { enabled: true } } });
    expect(ok.settings).not.toHaveProperty("share");
  });

  it("flags admin-only create settings (class B allow-list, schedules)", () => {
    const p = (settings: unknown) => projectCreateSchema.parse({ ...base, settings }).settings;
    expect(createNeedsAdmin(undefined)).toBe(false);
    expect(createNeedsAdmin(p({ maxPagesPerCrawl: 10, automation: { allowClassB: [] } }))).toBe(false);
    expect(createNeedsAdmin(p({ automation: { allowClassB: ["update_title"] } }))).toBe(true);
    expect(createNeedsAdmin(p({ schedule: { crawl: "off" } }))).toBe(true);
  });
});
