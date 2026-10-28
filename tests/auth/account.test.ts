import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked DB — these tests never touch a real database.
const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), delete: vi.fn() },
  membership: { findMany: vi.fn(), count: vi.fn() },
  project: { findMany: vi.fn() },
  integration: { findMany: vi.fn() },
  auditFinding: { findMany: vi.fn() },
  action: { findMany: vi.fn() },
  observation: { findMany: vi.fn() },
  organization: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  buildAccountExport,
  executeAccountDeletion,
  loadMembershipsForDeletion,
  planAccountDeletion,
  stripSecrets,
  type MembershipForDeletion,
} from "@/lib/auth/account";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("account export", () => {
  it("never includes credentialEncrypted, password hashes or other secrets", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "o@acme.com",
      name: "Owner",
      emailVerified: true,
      createdAt: new Date(),
      passwordHash: "$2b$12$shouldnotleak",
    });
    mockDb.membership.findMany.mockResolvedValue([
      { id: "m1", role: "owner", status: "active", invitedAt: null, createdAt: new Date(), organization: { id: "o1", name: "Acme" } },
      { id: "m2", role: "member", status: "active", invitedAt: null, createdAt: new Date(), organization: { id: "o2", name: "Other" } },
    ]);
    mockDb.project.findMany.mockResolvedValue([{ id: "p1", name: "Site", websiteUrl: "https://acme.com", settings: { share: { tokenId: "t" } } }]);
    // Even if a query returned the secret column, the export must strip it.
    mockDb.integration.findMany.mockResolvedValue([
      { id: "i1", provider: "wordpress", credentialEncrypted: "CIPHERTEXT", config: { apiToken: "x", siteUrl: "https://acme.com" } },
    ]);
    mockDb.auditFinding.findMany.mockResolvedValue([{ id: "f1", code: "missing_title" }]);
    mockDb.action.findMany.mockResolvedValue([{ id: "a1", type: "update_title" }]);
    mockDb.observation.findMany.mockResolvedValue([{ id: "ob1", provider: "openai", brandMentioned: true }]);

    const out = await buildAccountExport("u1");
    const text = JSON.stringify(out);
    expect(text).not.toContain("credentialEncrypted");
    expect(text).not.toContain("CIPHERTEXT");
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("apiToken");
    expect(text).not.toContain("tokenId");
    expect(out?.organizations).toHaveLength(1); // only owned orgs include project data
    expect(out?.organizations[0]?.findings).toHaveLength(1);
    expect(out?.memberships).toHaveLength(2);

    // The integration query must not select the credential column in the first place.
    const integrationArgs = mockDb.integration.findMany.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(integrationArgs.select.credentialEncrypted).toBeUndefined();
  });

  it("stripSecrets keeps dates and nested non-secret values", () => {
    const d = new Date();
    expect(stripSecrets({ a: d, b: [{ secretKey: 1, ok: 2 }] })).toEqual({ a: d, b: [{ ok: 2 }] });
  });
});

const m = (o: Partial<MembershipForDeletion>): MembershipForDeletion => ({
  organizationId: "o1",
  organizationName: "Acme",
  role: "owner",
  status: "active",
  otherActiveMembers: 0,
  otherActiveOwners: 0,
  ...o,
});

describe("account deletion guard", () => {
  it("deletes an org where the user is the sole member", () => {
    expect(planAccountDeletion([m({})])).toEqual({ blocked: [], deleteOrganizations: ["o1"], leaveOrganizations: [] });
  });

  it("blocks when the user is the sole owner of an org with other members", () => {
    const plan = planAccountDeletion([m({ otherActiveMembers: 2, otherActiveOwners: 0 })]);
    expect(plan.blocked).toEqual([{ organizationId: "o1", organizationName: "Acme" }]);
    expect(plan.deleteOrganizations).toEqual([]);
  });

  it("just leaves orgs that have another owner, or where the user isn't an owner", () => {
    const plan = planAccountDeletion([
      m({ organizationId: "o1", otherActiveMembers: 1, otherActiveOwners: 1 }),
      m({ organizationId: "o2", role: "member", otherActiveMembers: 3 }),
      m({ organizationId: "o3", role: "owner", status: "invited", otherActiveMembers: 3 }),
    ]);
    expect(plan).toEqual({ blocked: [], deleteOrganizations: [], leaveOrganizations: ["o1", "o2", "o3"] });
  });

  it("computes member/owner counts excluding the user", async () => {
    mockDb.membership.findMany.mockResolvedValue([{ organizationId: "o1", role: "owner", status: "active", organization: { name: "Acme" } }]);
    mockDb.membership.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const rows = await loadMembershipsForDeletion("u1");
    expect(rows).toEqual([m({ otherActiveMembers: 2, otherActiveOwners: 0 })]);
    expect(planAccountDeletion(rows).blocked).toHaveLength(1);
    const where = (mockDb.membership.count.mock.calls[0]![0] as { where: { userId: unknown } }).where;
    expect(where.userId).toEqual({ not: "u1" });
  });

  it("refuses to execute a blocked plan and deletes orgs + user otherwise", async () => {
    await expect(
      executeAccountDeletion("u1", { blocked: [{ organizationId: "o1", organizationName: "Acme" }], deleteOrganizations: [], leaveOrganizations: [] }),
    ).rejects.toThrow();

    const tx = {
      membership: { count: vi.fn().mockResolvedValue(0) },
      organization: { deleteMany: vi.fn() },
      user: { delete: vi.fn() },
    };
    mockDb.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    await executeAccountDeletion("u1", { blocked: [], deleteOrganizations: ["o1"], leaveOrganizations: [] });
    expect(tx.organization.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["o1"] } } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("aborts if someone joined the workspace before deletion committed", async () => {
    const tx = {
      membership: { count: vi.fn().mockResolvedValue(1) },
      organization: { deleteMany: vi.fn() },
      user: { delete: vi.fn() },
    };
    mockDb.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    await expect(executeAccountDeletion("u1", { blocked: [], deleteOrganizations: ["o1"], leaveOrganizations: [] })).rejects.toThrow();
    expect(tx.organization.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
