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
  user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { addStaff, removeStaff, setStaffRoles } from "@/lib/admin/team";
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
  beforeEach(() => vi.clearAllMocks());

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
