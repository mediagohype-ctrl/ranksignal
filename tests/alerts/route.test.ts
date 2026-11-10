// Route guards for /api/projects/[id]/alerts: role checks, tenant scoping, recipient validation.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin" as string,
  projectWhere: null as unknown,
  activeMembers: ["u1", "u2"] as string[],
  memberWhere: null as unknown,
  saved: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.c", organizationId: "org1", role: state.role })) }));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: vi.fn(async (t: Record<string, unknown>) => ({ ...t, role: state.role })) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: vi.fn(async (args: { where: { id: string; organizationId: string } }) => {
        state.projectWhere = args.where;
        return args.where.organizationId === "org1" && args.where.id === "p1" ? { id: "p1", organizationId: "org1", settings: null } : null;
      }),
    },
    organization: { findUnique: vi.fn(async () => ({ planId: "starter", whatsappOptIn: false, whatsappNumber: null })) },
    membership: {
      findMany: vi.fn(async (args: { where: { organizationId: string; userId?: { in: string[] } } }) => {
        state.memberWhere = args.where;
        const ids = args.where.userId?.in ?? state.activeMembers;
        return ids.filter((i) => state.activeMembers.includes(i)).map((userId) => ({ userId, role: "admin", user: { name: null, email: `${userId}@x.in` } }));
      }),
    },
    alertSettings: {
      findFirst: vi.fn(async () => (state.saved ? { id: "s1", config: state.saved, updatedAt: new Date() } : null)),
      create: vi.fn(async ({ data }: { data: { config: Record<string, unknown> } }) => (state.saved = data.config)),
      update: vi.fn(async ({ data }: { data: { config: Record<string, unknown> } }) => (state.saved = data.config)),
    },
    alertEvent: { findMany: vi.fn(async () => []) },
  },
}));

import { GET, PUT } from "@/app/api/projects/[id]/alerts/route";

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });
const body = (o: Record<string, unknown> = {}) => ({
  rules: { score_drop: { enabled: false, threshold: 8 } },
  channels: { inApp: true, email: true, whatsapp: true },
  recipients: [],
  digest: "daily",
  ...o,
});
const put = (b: unknown) => new Request("http://localhost/api/projects/p1/alerts", { method: "PUT", body: JSON.stringify(b) });

beforeEach(() => {
  state.role = "admin";
  state.saved = null;
});

describe("alerts API", () => {
  it("lets a viewer read settings but not the member list", async () => {
    state.role = "viewer";
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { item: { config: { rules: Record<string, { enabled: boolean }> }; members: unknown[]; canManage: boolean } };
    expect(json.item.config.rules.score_drop.enabled).toBe(true);
    expect(json.item.members).toEqual([]);
    expect(json.item.canManage).toBe(false);
  });

  it("scopes the project to the session's organization", async () => {
    const res = await GET(new Request("http://localhost"), ctx("p_other_org"));
    expect(res.status).toBe(404);
    expect(state.projectWhere).toEqual({ id: "p_other_org", organizationId: "org1" });
  });

  it("rejects writes from members", async () => {
    state.role = "member";
    const res = await PUT(put(body()), ctx());
    expect(res.status).toBe(403);
    expect(state.saved).toBeNull();
  });

  it("saves for admins, clamping thresholds", async () => {
    const res = await PUT(put(body({ rules: { score_drop: { enabled: false, threshold: 500 } } })), ctx());
    expect(res.status).toBe(200);
    expect(state.saved).toMatchObject({ rules: { score_drop: { enabled: false, threshold: 50 } }, digest: "daily" });
  });

  it("only accepts recipients who are active members of this organization", async () => {
    const res = await PUT(put(body({ recipients: ["u1", "intruder"] })), ctx());
    expect(res.status).toBe(400);
    expect(state.memberWhere).toMatchObject({ organizationId: "org1", status: "active" });
    expect(state.saved).toBeNull();
  });

  it("enforces the plan's recipient limit", async () => {
    state.activeMembers = ["u1", "u2", "u3", "u4"];
    const res = await PUT(put(body({ recipients: ["u1", "u2", "u3", "u4"] })), ctx());
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("too_many_recipients");
  });
});
