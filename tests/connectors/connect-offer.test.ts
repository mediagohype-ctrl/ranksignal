// Owner decision 1: Do it myself has no website connections — the connect routes refuse on the server (403).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ org: { planId: "starter", serviceTier: null as string | null }, created: 0 }));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "o1", role: "owner" })) }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: vi.fn(async (t: Record<string, unknown>) => t) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn(async () => h.org) },
    project: { findFirst: vi.fn(async () => ({ id: "p1", organizationId: "o1", websiteUrl: "https://acme.example" })) },
    integration: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => {
        h.created++;
        return {};
      }),
    },
  },
}));

import { POST as genericConnect } from "@/app/api/integrations/[id]/connect/route";
import { POST as wordpressConnect } from "@/app/api/integrations/wordpress/connect/route";
import { assertCanConnectWebsite, CONNECT_REFUSED_CODE } from "@/lib/connectors/offer-guard";

const req = (body: unknown) => new Request("http://localhost/api/integrations/x/connect", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  h.org = { planId: "starter", serviceTier: null };
  h.created = 0;
});

describe("website connections need Do it for me or Custom", () => {
  it("refuses Shopify/GitHub/… connections on Do it myself with a clear 403", async () => {
    const res = await genericConnect(req({ projectId: "p1", shopDomain: "acme.myshopify.com", accessToken: "shpat_abcdefghijkl" }), {
      params: Promise.resolve({ id: "shopify" }),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: { code: string; message: string } };
    expect(j.error.code).toBe(CONNECT_REFUSED_CODE);
    expect(j.error.message).toMatch(/Do it myself/);
    expect(h.created).toBe(0);
  });

  it("refuses WordPress on Do it myself and on the free trial", async () => {
    for (const planId of ["starter", "trial"]) {
      h.org = { planId, serviceTier: null };
      const res = await wordpressConnect(req({ projectId: "p1", siteUrl: "https://acme.example", username: "u", applicationPassword: "abcdefgh1234" }));
      expect(res.status).toBe(403);
    }
    expect(h.created).toBe(0);
  });

  it("allows Do it for me (service tier) and Custom plans", async () => {
    h.org = { planId: "starter", serviceTier: "grow" };
    await expect(assertCanConnectWebsite("o1")).resolves.toBeUndefined();
    h.org = { planId: "growth", serviceTier: null };
    await expect(assertCanConnectWebsite("o1")).resolves.toBeUndefined();
    h.org = { planId: "starter", serviceTier: null };
    await expect(assertCanConnectWebsite("o1")).rejects.toMatchObject({ status: 403 });
  });
});
