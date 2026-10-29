// requireStaff gating: admin route handlers answer 404 to signed-out users and non-staff (db + session mocked).
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  organization: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  featureFlag: { findMany: vi.fn(), findUnique: vi.fn() },
  workflowRun: { findUnique: vi.fn(), updateMany: vi.fn() },
  workflowEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  project: { findMany: vi.fn() },
  lead: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
const session = vi.hoisted(() => ({ getSession: vi.fn(), setSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { GET as flagsGet } from "@/app/api/admin/flags/route";
import { PATCH as orgPatch } from "@/app/api/admin/orgs/[id]/route";
import { POST as jobPost } from "@/app/api/admin/jobs/[id]/route";
import { POST as enterPost } from "@/app/api/admin/orgs/[id]/enter/route";
import { GET as searchGet } from "@/app/api/admin/search/route";

const STAFF_SESSION = { userId: "staff1", email: "staff@ranksignal.test", organizationId: "home", role: "owner" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonReq = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
});

function asSignedOut() {
  session.getSession.mockResolvedValue(null);
}
function asCustomer() {
  session.getSession.mockResolvedValue({ ...STAFF_SESSION, userId: "u1" });
  mockDb.user.findUnique.mockResolvedValue({ id: "u1", email: "c@acme.com", name: null, isStaff: false });
}
function asStaff() {
  session.getSession.mockResolvedValue(STAFF_SESSION);
  mockDb.user.findUnique.mockResolvedValue({ id: "staff1", email: STAFF_SESSION.email, name: "Staff", isStaff: true });
}

describe("admin routes are hidden from non-staff", () => {
  for (const [label, setup] of [
    ["signed out", asSignedOut],
    ["non-staff customer", asCustomer],
  ] as const) {
    it(`GET /api/admin/flags → 404 when ${label}`, async () => {
      setup();
      const res = await flagsGet();
      expect(res.status).toBe(404);
      expect(mockDb.featureFlag.findMany).not.toHaveBeenCalled();
    });

    it(`PATCH /api/admin/orgs/[id] → 404 and no write when ${label}`, async () => {
      setup();
      const res = await orgPatch(jsonReq("/api/admin/orgs/o1", "PATCH", { status: "suspended", reason: "ticket 1" }), params("o1"));
      expect(res.status).toBe(404);
      expect(mockDb.organization.update).not.toHaveBeenCalled();
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it(`POST /api/admin/jobs/[id] → 404 when ${label}`, async () => {
      setup();
      const res = await jobPost(jsonReq("/api/admin/jobs/j1", "POST", { action: "retry", reason: "ticket 1" }), params("j1"));
      expect(res.status).toBe(404);
      expect(mockDb.workflowRun.updateMany).not.toHaveBeenCalled();
    });

    it(`POST /api/admin/orgs/[id]/enter → 404 and no session when ${label}`, async () => {
      setup();
      const res = await enterPost(jsonReq("/api/admin/orgs/o1/enter", "POST", { reason: "ticket 1" }), params("o1"));
      expect(res.status).toBe(404);
      expect(session.setSessionCookie).not.toHaveBeenCalled();
    });
  }
});

describe("staff access", () => {
  it("search works for staff", async () => {
    asStaff();
    mockDb.organization.findMany.mockResolvedValue([{ id: "o1", name: "Acme", planId: "growth", status: "active" }]);
    mockDb.project.findMany.mockResolvedValue([]);
    mockDb.lead.findMany.mockResolvedValue([]);
    mockDb.user.findMany.mockResolvedValue([]);
    const res = await searchGet(new Request("http://localhost/api/admin/search?q=acme"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { type: string; href: string }[] };
    expect(body.items[0]).toMatchObject({ type: "org", href: "/admin/customers/o1" });
  });

  it("org changes require a reason and are audit-logged", async () => {
    asStaff();
    const noReason = await orgPatch(jsonReq("/api/admin/orgs/o1", "PATCH", { planId: "growth" }), params("o1"));
    expect(noReason.status).toBe(400);

    mockDb.organization.findUnique.mockResolvedValue({ id: "o1", name: "Acme", publishingEnabled: true, status: "active", planId: "starter", serviceTier: null });
    mockDb.organization.update.mockResolvedValue({ id: "o1", name: "Acme", publishingEnabled: true, status: "active", planId: "starter", serviceTier: "grow" });
    const res = await orgPatch(jsonReq("/api/admin/orgs/o1", "PATCH", { serviceTier: "grow", reason: "Signed Grow contract" }), params("o1"));
    expect(res.status).toBe(200);
    const audit = mockDb.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "admin.org_service_tier_changed", actorType: "staff", actorId: "staff1", organizationId: "o1" });
    expect(audit.before).toEqual({ serviceTier: null });
    expect(audit.after).toMatchObject({ serviceTier: "grow", reason: "Signed Grow contract" });
  });

  it("enter issues a staffMode admin session for the target org", async () => {
    asStaff();
    mockDb.organization.findUnique.mockResolvedValue({ id: "o1", name: "Acme" });
    const res = await enterPost(jsonReq("/api/admin/orgs/o1/enter", "POST", { reason: "Support ticket 42" }), params("o1"));
    expect(res.status).toBe(200);
    expect(session.setSessionCookie).toHaveBeenCalledWith({
      userId: "staff1",
      email: STAFF_SESSION.email,
      organizationId: "o1",
      role: "admin",
      staffMode: true,
    }, { maxAgeSeconds: 7200 });
    expect(mockDb.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "support.enter", organizationId: "o1" });
  });

  it("retry only applies to failed jobs", async () => {
    asStaff();
    mockDb.workflowRun.findUnique.mockResolvedValue({ id: "j1", organizationId: "o1", kind: "crawl", state: "running", attempts: 1, error: null, errorClass: null });
    mockDb.workflowRun.updateMany.mockResolvedValue({ count: 0 });
    const res = await jobPost(jsonReq("/api/admin/jobs/j1", "POST", { action: "retry", reason: "ticket 7" }), params("j1"));
    expect(res.status).toBe(409);
    expect(mockDb.workflowRun.updateMany.mock.calls[0][0].where).toEqual({ id: "j1", state: { in: ["failed"] } });
    expect(mockDb.auditLog.create).not.toHaveBeenCalled();
  });
});
