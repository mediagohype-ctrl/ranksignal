// Staff roles → permissions (pure) and team management safety rules (db mocked).
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SECTIONS,
  ALL_PERMISSIONS,
  firstAllowedPath,
  normalizeRoles,
  PERMISSIONS,
  permissionsFor,
  STAFF_ROLE_IDS,
  STAFF_ROLES,
} from "@/lib/admin/rbac";
import { ownSiteSetup } from "@/lib/admin/seo";

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  membership: { findFirst: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  organization: { findFirst: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
// Callback form runs with the same mock as the transaction client; array form resolves each promise.
const txImpl = (arg: unknown) =>
  typeof arg === "function" ? (arg as (tx: typeof mockDb) => unknown)(mockDb) : Promise.all(arg as Promise<unknown>[]);
vi.mock("@/lib/db", () => ({ db: mockDb }));
// Real bcrypt (cost 12) is slow enough to starve other test files running in parallel; a reversible fake keeps
// the "only a hash is stored, and it matches the returned password" checks meaningful.
vi.mock("@/lib/auth/password", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/password")>()),
  hashPassword: async (p: string) => `fakehash:${Buffer.from(p).toString("base64")}`,
  verifyPassword: async (p: string, h: string | null | undefined) => h === `fakehash:${Buffer.from(p).toString("base64")}`,
}));

import { addStaff, createStaffAccount, generatePassword, removeStaff, setStaffPassword, setStaffRoles } from "@/lib/admin/team";
import { verifyPassword } from "@/lib/auth/password";
import type { StaffContext } from "@/lib/admin/guard";

describe("rbac catalogue", () => {
  it("every role only uses known permissions and every section has a permission", () => {
    for (const r of STAFF_ROLE_IDS) for (const p of STAFF_ROLES[r].permissions) expect(PERMISSIONS).toHaveProperty(p);
    for (const s of ADMIN_SECTIONS) expect(ALL_PERMISSIONS).toContain(s.permission);
  });

  it("super admin has everything; the read-only role has no change rights", () => {
    expect(permissionsFor(["super_admin"]).size).toBe(ALL_PERMISSIONS.length);
    const viewer = permissionsFor(["viewer"]);
    expect([...viewer].every((p) => p.endsWith(".view"))).toBe(true);
    expect(viewer.has("team.manage")).toBe(false);
  });

  it("only super admins can manage the team", () => {
    for (const r of STAFF_ROLE_IDS) expect(permissionsFor([r]).has("team.manage"), r).toBe(r === "super_admin");
  });

  it("multiple roles combine; unknown roles are ignored", () => {
    const p = permissionsFor(["seo", "finance", "hacker"]);
    expect(p.has("seo.manage")).toBe(true);
    expect(p.has("revenue.view")).toBe(true);
    expect(p.has("flags.manage")).toBe(false);
    expect(normalizeRoles(["finance", "seo", "seo", "nope"])).toEqual(["seo", "finance"]);
    expect(permissionsFor(null).size).toBe(0);
  });

  it("each team lands on its own first section", () => {
    expect(firstAllowedPath(permissionsFor(["seo"]))).toBe("/admin/seo");
    expect(firstAllowedPath(permissionsFor(["finance"]))).toBe("/admin");
    expect(firstAllowedPath(permissionsFor(["sales"]))).toBe("/admin/customers");
    expect(firstAllowedPath(permissionsFor([]))).toBeNull();
  });

  it("finance sees money but cannot enter workspaces; SEO cannot see revenue", () => {
    const fin = permissionsFor(["finance"]);
    expect(fin.has("revenue.view") && fin.has("ai.view")).toBe(true);
    expect(fin.has("customers.enter")).toBe(false);
    expect(permissionsFor(["seo"]).has("revenue.view")).toBe(false);
  });
});

describe("own-site SEO set-up checklist", () => {
  it("flags missing verification and sameAs, passes when configured", () => {
    const bad = ownSiteSetup({ APP_URL: "http://localhost:3000" });
    expect(bad.every((c) => !c.ok)).toBe(true);
    const good = ownSiteSetup({
      APP_URL: "https://mywebrank.tech",
      GOOGLE_SITE_VERIFICATION: "g",
      BING_SITE_VERIFICATION: "b",
      INDEXNOW_KEY: "0123456789abcdef",
      BRAND_SAME_AS: "https://linkedin.com/company/x,https://x.com/x",
    });
    expect(good.every((c) => c.ok)).toBe(true);
  });
});

describe("team management safety", () => {
  const me = { user: { id: "me", email: "boss@x.com", name: null } } as StaffContext;
  const req = () => new Request("http://localhost/api/admin/team", { method: "POST" });
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(txImpl);
  });

  it("can't change your own roles", async () => {
    await expect(setStaffRoles(me, req(), "me", { roles: ["seo"], reason: "test" })).rejects.toMatchObject({ status: 400 });
  });

  it("won't demote or remove the last super admin", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isStaff: true, staffRoles: ["super_admin"] });
    mockDb.user.count.mockResolvedValue(0);
    await expect(setStaffRoles(me, req(), "u2", { roles: ["seo"], reason: "test" })).rejects.toMatchObject({ status: 409 });
    await expect(removeStaff(me, req(), "u2", "test")).rejects.toMatchObject({ status: 409 });
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("adds an existing account with roles and audit-logs it", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "u3", isStaff: false, staffRoles: [] });
    mockDb.user.update.mockResolvedValue({ id: "u3", email: "seo@x.com", staffRoles: ["seo"] });
    await addStaff(me, req(), { email: "seo@x.com", roles: ["seo"], reason: "new hire" });
    expect(mockDb.user.update.mock.calls[0][0].data).toEqual({ isStaff: true, staffRoles: ["seo"] });
    expect(mockDb.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "admin.staff_granted", resourceId: "u3" });
  });

  it("asks people to sign up first when the email has no account", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    await expect(addStaff(me, req(), { email: "new@x.com", roles: ["seo"], reason: "new hire" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("employee accounts and passwords", () => {
  const me = { user: { id: "me", email: "boss@x.com", name: null } } as StaffContext;
  const req = () => new Request("http://localhost/api/admin/team/accounts", { method: "POST" });
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(txImpl);
  });

  it("generated passwords are long and unambiguous", () => {
    const p = generatePassword();
    expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
    expect(generatePassword()).not.toBe(p);
  });

  it("creates a verified staff account in the internal team workspace and returns the password once", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "u9", email: data.email, name: data.name, staffRoles: data.staffRoles }));
    mockDb.membership.findFirst.mockResolvedValue(null);
    mockDb.organization.findFirst.mockResolvedValue(null);
    mockDb.organization.create.mockResolvedValue({ id: "team" });
    const r = await createStaffAccount(me, req(), { name: "Priya", email: "priya@x.com", password: "", roles: ["content_writer"], reason: "new hire" });
    const data = mockDb.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "priya@x.com", isStaff: true, emailVerified: true, staffRoles: ["content_writer"] });
    expect(await verifyPassword(r.password, data.passwordHash)).toBe(true);
    expect(mockDb.organization.create.mock.calls[0][0].data).toMatchObject({ isInternal: true, planId: "agency" });
    expect(mockDb.membership.upsert.mock.calls[0][0].create).toMatchObject({ userId: "u9", organizationId: "team", role: "member", status: "active" });
    const audit = mockDb.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "admin.staff_account_created" });
    expect(JSON.stringify(audit)).not.toContain(r.password);
  });

  it("refuses an email that already has an account, and weak passwords", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "u1" });
    await expect(createStaffAccount(me, req(), { name: "A", email: "a@x.com", password: "", roles: ["seo"], reason: "x y z" })).rejects.toMatchObject({ status: 409 });
    mockDb.user.findUnique.mockResolvedValue(null);
    await expect(
      createStaffAccount(me, req(), { name: "A", email: "abcdefghij@x.com", password: "abcdefghij", roles: ["seo"], reason: "x y z" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("sets a staff member password, but never your own or a customer's", async () => {
    await expect(setStaffPassword(me, req(), "me", { password: "", reason: "forgot" })).rejects.toMatchObject({ status: 400 });
    mockDb.user.findUnique.mockResolvedValue({ id: "c1", email: "c@x.com", isStaff: false });
    await expect(setStaffPassword(me, req(), "c1", { password: "", reason: "forgot" })).rejects.toMatchObject({ status: 404 });
    mockDb.user.findUnique.mockResolvedValue({ id: "u2", email: "u2@x.com", isStaff: true });
    mockDb.membership.findFirst.mockResolvedValue({ id: "m1" });
    const r = await setStaffPassword(me, req(), "u2", { password: "Correct-Horse-9", reason: "forgot" });
    expect(r.password).toBe("Correct-Horse-9");
    const hash = mockDb.user.update.mock.calls[0][0].data.passwordHash;
    expect(await verifyPassword("Correct-Horse-9", hash)).toBe(true);
  });

  it("removing someone also removes them from the team workspace", async () => {
    mockDb.user.findUnique.mockResolvedValue({ isStaff: true, staffRoles: ["seo"] });
    mockDb.user.count.mockResolvedValue(1);
    await removeStaff(me, req(), "u2", "left company");
    expect(mockDb.membership.updateMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "u2", organization: { isInternal: true } },
      data: { status: "removed" },
    });
  });
});
