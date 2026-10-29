// Regression tests for the invite-takeover finding: signing up with an invited email (no invite token) must not
// claim the placeholder account, and pending invitations must not be accepted or listed for unverified accounts.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionContext } from "@/lib/types";

type Row = Record<string, unknown> & { id: string };

const h = vi.hoisted(() => ({
  users: [] as Row[],
  memberships: [] as Row[],
  orgs: [] as Row[],
  session: null as SessionContext | null,
  cookies: [] as unknown[],
  seq: 0,
}));

function makeDb() {
  const user = {
    findUnique: async (a: { where: { id?: string; email?: string } }) =>
      h.users.find((u) => (a.where.id ? u.id === a.where.id : u.email === a.where.email)) ?? null,
    findUniqueOrThrow: async (a: { where: { id: string } }) => {
      const u = h.users.find((x) => x.id === a.where.id);
      if (!u) throw new Error("not found");
      return u;
    },
    create: async (a: { data: Record<string, unknown> }) => {
      if (h.users.some((u) => u.email === a.data.email)) throw Object.assign(new Error("unique"), { code: "P2002" });
      const row = { id: `u${++h.seq}`, emailVerified: false, isStaff: false, name: null, ...a.data } as Row;
      h.users.push(row);
      return row;
    },
    updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const m = h.users.filter((u) => Object.entries(a.where).every(([k, v]) => u[k] === v));
      m.forEach((u) => Object.assign(u, a.data));
      return { count: m.length };
    },
  };
  const withOrg = (m: Row) => ({ ...m, organization: h.orgs.find((o) => o.id === m.organizationId) });
  const membership = {
    findUnique: async (a: { where: { id?: string; userId_organizationId?: { userId: string; organizationId: string } } }) => {
      const k = a.where.userId_organizationId;
      const m = h.memberships.find((x) => (a.where.id ? x.id === a.where.id : x.userId === k?.userId && x.organizationId === k?.organizationId));
      return m ? withOrg(m) : null;
    },
    findMany: async (a: { where: { userId: string; status?: { in: string[] } } }) =>
      h.memberships.filter((m) => m.userId === a.where.userId && (!a.where.status || a.where.status.in.includes(m.status as string))).map(withOrg),
    create: async (a: { data: Record<string, unknown> }) => {
      const row = { id: `m${++h.seq}`, ...a.data } as Row;
      h.memberships.push(row);
      return row;
    },
    update: async (a: { where: { id: string }; data: Record<string, unknown> }) => {
      const m = h.memberships.find((x) => x.id === a.where.id)!;
      return Object.assign(m, a.data);
    },
    updateMany: async (a: { where: { id: string; status?: string }; data: Record<string, unknown> }) => {
      const m = h.memberships.filter((x) => x.id === a.where.id && (!a.where.status || x.status === a.where.status));
      m.forEach((x) => Object.assign(x, a.data));
      return { count: m.length };
    },
  };
  const organization = {
    create: async (a: { data: Record<string, unknown> }) => {
      const row = { id: `o${++h.seq}`, ...a.data } as Row;
      h.orgs.push(row);
      return row;
    },
  };
  const db = {
    user,
    membership,
    organization,
    subscription: { create: async () => ({}), findFirst: async () => null },
    auditLog: { create: async () => ({}) },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return db;
}

vi.mock("@/lib/db", () => ({ db: makeDb() }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => h.session,
  setSessionCookie: async (ctx: unknown) => void h.cookies.push(ctx),
}));
vi.mock("@/lib/auth/access", () => ({ resolveAccess: async (t: SessionContext) => t }));
vi.mock("@/lib/auth/email-verification", () => ({ sendVerificationEmail: async () => ({ ok: true }) }));

import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as switchOrg } from "@/app/api/auth/switch-org/route";
import { GET as me } from "@/app/api/auth/me/route";
import { createInviteToken } from "@/lib/auth/invite";
import { UNUSABLE_PASSWORD } from "@/lib/auth/password";

const VICTIM_ORG = "org_victim";
const INVITED = "invitee@acme-corp.com";

function post(body: unknown, ip = "203.0.113.7") {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const attackerBody = { email: INVITED, password: "correct horse battery staple", name: "Mallory", organizationName: "Evil" };

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-0123456789";
});

let ipSeq = 0;
beforeEach(() => {
  h.users.length = 0;
  h.memberships.length = 0;
  h.orgs.length = 0;
  h.cookies.length = 0;
  h.session = null;
  h.orgs.push({ id: VICTIM_ORG, name: "Victim Co", planId: "growth", status: "active", region: "IN", publishingEnabled: true });
  h.users.push({ id: "placeholder", email: INVITED, passwordHash: UNUSABLE_PASSWORD, emailVerified: false, name: null, isStaff: false });
  h.memberships.push({ id: "inv1", userId: "placeholder", organizationId: VICTIM_ORG, role: "admin", status: "invited" });
  ipSeq++;
});

describe("signup cannot claim an invited (placeholder) account", () => {
  it("without the invite token: 409, password untouched, invite still pending", async () => {
    const res = await signup(post(attackerBody, `198.51.100.${ipSeq}`));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("email_unavailable");
    expect(h.users[0].passwordHash).toBe(UNUSABLE_PASSWORD);
    expect(h.memberships[0].status).toBe("invited");
    expect(h.cookies).toHaveLength(0);
  });

  it("with a token for a different invitation/email: still refused", async () => {
    const other = await createInviteToken("inv1", "someone-else@acme-corp.com");
    const res = await signup(post({ ...attackerBody, inviteToken: other }, `198.51.100.${ipSeq}`));
    expect(res.status).toBe(409);
    const forged = await createInviteToken("does-not-exist", INVITED);
    expect((await signup(post({ ...attackerBody, inviteToken: forged }, `198.51.100.${ipSeq}`))).status).toBe(409);
    expect(h.users[0].passwordHash).toBe(UNUSABLE_PASSWORD);
  });

  it("gives the same answer for a real account as for an invited email (no enumeration difference)", async () => {
    const invited = await (await signup(post(attackerBody, `198.51.100.${ipSeq}`))).json();
    h.users[0].passwordHash = "$2b$12$realhashrealhashrealhashrealhashrealhashrealhashreal";
    const real = await (await signup(post(attackerBody, `198.51.100.${ipSeq}`))).json();
    const shape = (e: { code: string; message: string; details: unknown }) => ({ code: e.code, message: e.message, details: e.details });
    expect(shape(real.error)).toEqual(shape(invited.error));
  });

  it("with the emailed invite token, the invitee can create the account (and the inbox counts as verified)", async () => {
    const token = await createInviteToken("inv1", INVITED);
    const res = await signup(post({ ...attackerBody, name: "Invitee", inviteToken: token }, `198.51.100.${ipSeq}`));
    expect(res.status).toBe(201);
    expect(h.users[0].passwordHash).not.toBe(UNUSABLE_PASSWORD);
    expect(h.users[0].emailVerified).toBe(true);
    // Joining the inviting workspace still goes through /accept-invite.
    expect(h.memberships.find((m) => m.id === "inv1")!.status).toBe("invited");
  });

  it("brand-new accounts start unverified", async () => {
    const res = await signup(post({ ...attackerBody, email: "fresh@acme-corp.com" }, `198.51.100.${ipSeq}`));
    expect(res.status).toBe(201);
    expect(h.users.find((u) => u.email === "fresh@acme-corp.com")!.emailVerified).toBe(false);
  });
});

describe("pending invitations for unverified accounts", () => {
  // Attacker registered the address BEFORE the invite was sent: real (unverified) account with an invited membership.
  beforeEach(() => {
    h.users[0].passwordHash = "$2b$12$attackerhashattackerhashattackerhashattackerhashatt";
    h.orgs.push({ id: "org_own", name: "Evil", planId: "trial", status: "active", region: "IN", publishingEnabled: true });
    h.memberships.push({ id: "own1", userId: "placeholder", organizationId: "org_own", role: "owner", status: "active" });
    h.session = { userId: "placeholder", email: INVITED, organizationId: "org_own", role: "owner" };
  });

  const switchReq = (organizationId: string) =>
    new Request("http://localhost/api/auth/switch-org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId }) });

  it("switch-org does not auto-accept the invite", async () => {
    const res = await switchOrg(switchReq(VICTIM_ORG));
    expect(res.status).toBe(404);
    expect(h.memberships.find((m) => m.id === "inv1")!.status).toBe("invited");
    expect(h.cookies).toHaveLength(0);
  });

  it("/api/auth/me hides pending invites from unverified users", async () => {
    const body = await (await me()).json();
    expect(body.item.organizations.map((o: { id: string }) => o.id)).toEqual(["org_own"]);
  });

  it("after the email is verified, the invite is visible and can be accepted", async () => {
    h.users[0].emailVerified = true;
    const listed = await (await me()).json();
    expect(listed.item.organizations.map((o: { id: string }) => o.id)).toContain(VICTIM_ORG);
    const res = await switchOrg(switchReq(VICTIM_ORG));
    expect(res.status).toBe(200);
    expect(h.memberships.find((m) => m.id === "inv1")!.status).toBe("active");
  });
});
