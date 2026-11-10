// Route guards for /api/projects/[id]/report-templates: roles, tenant scoping, plan limits.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "member" as string,
  planId: "growth",
  count: 0,
  created: [] as Record<string, unknown>[],
  findWhere: [] as unknown[],
  template: null as Record<string, unknown> | null,
  updated: null as unknown,
  deleted: null as unknown,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org1", role: state.role })) }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: vi.fn(async (t: Record<string, unknown>) => ({ ...t, role: state.role })) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined) }));

const row = (o: Record<string, unknown> = {}) => ({
  id: "t1", organizationId: "org1", projectId: "p1", name: "Monthly", sections: [], intro: null, notes: null, range: null,
  isOrgDefault: false, shareEnabled: false, updatedAt: new Date("2026-11-01T00:00:00Z"), ...o,
});

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) =>
        args.where.organizationId === "org1" && args.where.id === "p1" ? { id: "p1", organizationId: "org1", settings: null } : null),
    },
    organization: { findUnique: vi.fn(async () => ({ planId: state.planId })) },
    reportTemplate: {
      count: vi.fn(async () => state.count),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async (args: { where: unknown }) => {
        state.findWhere.push(args.where);
        return state.template;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data);
        return row(data);
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => row(data)),
      updateMany: vi.fn(async (args: unknown) => {
        state.updated = args;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async (args: unknown) => {
        state.deleted = args;
        return { count: 1 };
      }),
    },
  },
}));

import { GET, POST } from "@/app/api/projects/[id]/report-templates/route";
import { DELETE, PATCH } from "@/app/api/projects/[id]/report-templates/[templateId]/route";

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const tctx = (templateId = "t1", id = "p1") => ({ params: Promise.resolve({ id, templateId }) });
const req = (method: string, body?: unknown) => new Request("http://localhost/api/x", { method, body: body === undefined ? undefined : JSON.stringify(body) });
const tpl = (o: Record<string, unknown> = {}) => ({ name: "Monthly", sections: [{ id: "scores", enabled: true }], intro: "", notes: "", range: { preset: "last_month" }, ...o });

beforeEach(() => {
  state.role = "member";
  state.planId = "growth";
  state.count = 0;
  state.created = [];
  state.findWhere = [];
  state.template = null;
  state.updated = null;
  state.deleted = null;
});

describe("report templates API", () => {
  it("viewers can list but not create", async () => {
    state.role = "viewer";
    expect((await GET(req("GET"), ctx())).status).toBe(200);
    expect((await POST(req("POST", tpl()), ctx())).status).toBe(403);
  });

  it("other organizations' projects are 404", async () => {
    expect((await POST(req("POST", tpl()), ctx("p_other"))).status).toBe(404);
  });

  it("members create project templates in their own org; sharing is ignored for non-admins", async () => {
    const res = await POST(req("POST", tpl({ shareEnabled: true })), ctx());
    expect(res.status).toBe(201);
    expect(state.created[0]).toMatchObject({ organizationId: "org1", projectId: "p1", createdById: "u1", shareEnabled: false });
  });

  it("enforces the per-website template limit", async () => {
    state.planId = "trial";
    state.count = 1;
    const res = await POST(req("POST", tpl()), ctx());
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("template_limit");
  });

  it("only admins can save the organization default, and only on plans that include it", async () => {
    expect((await POST(req("POST", tpl({ scope: "org_default" })), ctx())).status).toBe(403);
    state.role = "admin";
    state.planId = "starter";
    expect((await POST(req("POST", tpl({ scope: "org_default" })), ctx())).status).toBe(403);
    state.planId = "agency";
    expect((await POST(req("POST", tpl({ scope: "org_default" })), ctx())).status).toBe(201);
    expect(state.created.at(-1)).toMatchObject({ organizationId: "org1", projectId: null, isOrgDefault: true });
  });

  it("template lookups are scoped to the org and to this project (or the org default)", async () => {
    await PATCH(req("PATCH", { name: "New name" }), tctx("t_x"));
    expect(state.findWhere[0]).toEqual({ id: "t_x", organizationId: "org1", OR: [{ projectId: "p1" }, { projectId: null, isOrgDefault: true }] });
  });

  it("unknown templates are 404", async () => {
    expect((await PATCH(req("PATCH", { name: "x" }), tctx())).status).toBe(404);
    expect((await DELETE(req("DELETE"), tctx())).status).toBe(404);
  });

  it("members can't switch on sharing or edit the org default", async () => {
    state.template = row();
    expect((await PATCH(req("PATCH", { shareEnabled: true }), tctx())).status).toBe(403);
    state.template = row({ projectId: null, isOrgDefault: true });
    expect((await PATCH(req("PATCH", { name: "x" }), tctx())).status).toBe(403);
    expect((await DELETE(req("DELETE"), tctx())).status).toBe(403);
  });

  it("admins can share a project template; writes are scoped by organization", async () => {
    state.role = "admin";
    state.template = row();
    const res = await PATCH(req("PATCH", { shareEnabled: true }), tctx());
    expect(res.status).toBe(200);
    expect(state.updated).toMatchObject({ where: { id: "t1", organizationId: "org1" }, data: { shareEnabled: true } });
    expect((await DELETE(req("DELETE"), tctx())).status).toBe(200);
    expect(state.deleted).toEqual({ where: { id: "t1", organizationId: "org1" } });
  });
});
