// API key lifecycle: plan limits, secret shown once (hash stored), audit log without secrets, org-scoped revoke,
// and the settings server actions' role guard.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  apiKey: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  membership: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
const session = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));

import { hashApiKey } from "@/lib/api-keys/keys";
import { createApiKey, revokeApiKey } from "@/lib/api-keys/service";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/app/settings/api/actions";

const actor = { actorId: "u1", actorType: "user" as const };
const view = (o: Record<string, unknown> = {}) => ({ id: "k1", name: "Looker", prefix: "mwr_abcdefgh", scopes: ["read"], createdAt: new Date(), lastUsedAt: null, revokedAt: null, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.organization.findUnique.mockResolvedValue({ planId: "starter", status: "active" });
  mockDb.apiKey.count.mockResolvedValue(0);
  mockDb.apiKey.create.mockImplementation(async ({ data }: { data: { name: string; prefix: string } }) => view({ name: data.name, prefix: data.prefix }));
  mockDb.auditLog.create.mockResolvedValue({});
});

describe("createApiKey", () => {
  it("stores only the hash and prefix, returns the key once, and audit-logs without the secret", async () => {
    const r = await createApiKey("orgA", "  Looker  ", actor);
    const data = mockDb.apiKey.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: "orgA", name: "Looker", scopes: ["read"], createdById: "u1" });
    expect(data.keyHash).toBe(hashApiKey(r.key));
    expect(JSON.stringify(data)).not.toContain(r.key);
    expect(data.prefix).toBe(r.key.slice(0, 12));
    const audit = mockDb.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ organizationId: "orgA", action: "api_key.created", resourceType: "api_key" });
    expect(JSON.stringify(audit)).not.toContain(r.key.slice(12));
    expect(JSON.stringify(audit)).not.toContain(data.keyHash);
  });

  it("enforces the plan's active-key limit (402)", async () => {
    mockDb.apiKey.count.mockResolvedValue(2); // starter allows 2
    await expect(createApiKey("orgA", "x", actor)).rejects.toMatchObject({ status: 402, code: "plan_limit" });
    expect(mockDb.apiKey.create).not.toHaveBeenCalled();
  });

  it("rejects empty names and suspended workspaces", async () => {
    await expect(createApiKey("orgA", "   ", actor)).rejects.toMatchObject({ status: 400 });
    mockDb.organization.findUnique.mockResolvedValue({ planId: "growth", status: "suspended" });
    await expect(createApiKey("orgA", "ok", actor)).rejects.toMatchObject({ status: 403 });
  });
});

describe("revokeApiKey", () => {
  it("only finds keys in the caller's organization", async () => {
    mockDb.apiKey.findFirst.mockResolvedValue(null);
    await expect(revokeApiKey("orgA", "kOther", actor)).rejects.toMatchObject({ status: 404 });
    expect(mockDb.apiKey.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "kOther", organizationId: "orgA" } }));
    expect(mockDb.apiKey.update).not.toHaveBeenCalled();
  });

  it("revokes, records who did it and audit-logs; idempotent for revoked keys", async () => {
    mockDb.apiKey.findFirst.mockResolvedValue(view());
    mockDb.apiKey.update.mockResolvedValue(view({ revokedAt: new Date() }));
    const r = await revokeApiKey("orgA", "k1", actor);
    expect(r.revokedAt).toBeTruthy();
    expect(mockDb.apiKey.update.mock.calls[0][0].data).toMatchObject({ revokedById: "u1" });
    expect(mockDb.auditLog.create.mock.calls[0][0].data.action).toBe("api_key.revoked");

    vi.clearAllMocks();
    mockDb.apiKey.findFirst.mockResolvedValue(view({ revokedAt: new Date() }));
    await revokeApiKey("orgA", "k1", actor);
    expect(mockDb.apiKey.update).not.toHaveBeenCalled();
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("settings server actions", () => {
  const as = (role: string) => {
    session.getSession.mockResolvedValue({ userId: "u1", email: "a@b.c", organizationId: "orgA", role });
    mockDb.membership.findUnique.mockResolvedValue({ role, status: "active" });
  };

  it("members and viewers cannot create or revoke keys", async () => {
    for (const role of ["member", "viewer"]) {
      as(role);
      expect(await createApiKeyAction("x")).toEqual({ ok: false, error: "Insufficient role" });
      expect(await revokeApiKeyAction("k1")).toEqual({ ok: false, error: "Insufficient role" });
    }
    expect(mockDb.apiKey.create).not.toHaveBeenCalled();
    expect(mockDb.apiKey.update).not.toHaveBeenCalled();
  });

  it("signed-out users are refused", async () => {
    session.getSession.mockResolvedValue(null);
    expect((await createApiKeyAction("x")).ok).toBe(false);
  });

  it("admins create keys in their own organization", async () => {
    as("admin");
    const r = await createApiKeyAction("Looker");
    expect(r.ok).toBe(true);
    expect(mockDb.apiKey.create.mock.calls[0][0].data.organizationId).toBe("orgA");
    expect(mockDb.auditLog.create.mock.calls[0][0].data.ip).toBe("1.2.3.4");
  });
});
