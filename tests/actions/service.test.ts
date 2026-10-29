import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./fake-db";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, enqueued: [] as Record<string, unknown>[] }));
vi.mock("@/lib/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/jobs/queue", () => ({
  enqueue: async (o: Record<string, unknown>) => {
    h.enqueued.push(o);
    return { id: `run-${h.enqueued.length}`, state: "queued" };
  },
}));

import { approve, editDraft, reject, requestApproval, requestExecution } from "@/lib/actions/service";
import { canonicalJson, draftHash } from "@/lib/actions/hash";
import { POLICY_VERSION } from "@/lib/policy/engine";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import type { SessionContext } from "@/lib/types";

const member: SessionContext = { userId: "u1", email: "m@x.io", organizationId: "o1", role: "member" };
const admin: SessionContext = { ...member, userId: "u2", role: "admin" };
/** A second member: approvals must come from someone other than the requester/editor (separation of duties). */
const reviewer: SessionContext = { ...member, userId: "u3", email: "r@x.io" };

function seed(over: Record<string, unknown> = {}) {
  h.db.organization.rows.push({ id: "o1", publishingEnabled: true });
  h.db.project.rows.push({ id: "p1", organizationId: "o1", websiteUrl: "https://acme.example", settings: null });
  h.db.integration.rows.push({ id: "i1", organizationId: "o1", projectId: "p1", provider: "wordpress", credentialEncrypted: "v1:x", capabilities: WORDPRESS_CAPABILITIES });
  const base = {
    id: "a1", organizationId: "o1", projectId: "p1", type: "update_meta_description",
    target: { resourceType: "page", url: "https://acme.example/blog/a" },
    proposedChange: { field: "meta_description", before: null, after: "First draft about widgets." },
    policyVersion: POLICY_VERSION, riskClass: "B", policyDecision: "approval_required", status: "proposed",
    integrationId: "i1", rationale: "missing", ...over,
  };
  const action = { ...base, draftHash: draftHash(base as never) };
  h.db.action.rows.push(action);
  return action;
}

beforeEach(() => {
  h.db = createFakeDb();
  h.enqueued = [];
});

describe("draft hash", () => {
  it("is stable across key order and changes with content", () => {
    const a = { type: "t", target: { url: "u", resourceType: "page" }, proposedChange: { field: "f", before: null, after: "x" }, policyVersion: "v" };
    const b = { policyVersion: "v", proposedChange: { after: "x", before: null, field: "f" }, target: { resourceType: "page", url: "u" }, type: "t" };
    expect(draftHash(a)).toBe(draftHash(b));
    expect(draftHash(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(draftHash({ ...a, proposedChange: { ...a.proposedChange, after: "y" } })).not.toBe(draftHash(a));
    expect(draftHash({ ...a, policyVersion: "other" })).not.toBe(draftHash(a));
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });
});

describe("approvals", () => {
  it("requests approval with 7-day expiry and a notification", async () => {
    const a = seed();
    const ap = await requestApproval(a.id, member);
    expect(ap.decision).toBe("pending");
    expect((ap.expiresAt as Date).getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(h.db.action.rows[0].status).toBe("awaiting_approval");
    expect(h.db.notification.rows[0].type).toBe("approval_requested");
    expect(h.db.auditLog.rows.some((r) => r.action === "action.approval_requested")).toBe(true);
  });

  it("rejects approval with a stale hash (409 stale_draft)", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await expect(approve(a.id, { draftHash: "0".repeat(64) }, reviewer)).rejects.toMatchObject({ status: 409, code: "stale_draft" });
    expect(h.db.action.rows[0].status).toBe("awaiting_approval");
  });

  it("approves the exact current hash", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    const { action, approval } = await approve(a.id, { draftHash: a.draftHash }, reviewer);
    expect(action.status).toBe("approved");
    expect(approval.decision).toBe("approved");
    expect(h.db.auditLog.rows.some((r) => r.action === "action.approved")).toBe(true);
  });

  it("requires admin+ for class C", async () => {
    const a = seed({ type: "add_faq_schema", riskClass: "C", proposedChange: { field: "schema", before: null, after: "{}" } });
    a.draftHash = draftHash(a as never);
    await requestApproval(a.id, member);
    await expect(approve(a.id, { draftHash: a.draftHash }, reviewer)).rejects.toMatchObject({ status: 403 });
    const { action } = await approve(a.id, { draftHash: a.draftHash }, admin);
    expect(action.status).toBe("approved");
  });

  it("rejects expired approvals", async () => {
    const a = seed();
    await requestApproval(a.id, member, { ttlMs: -1000 });
    await expect(approve(a.id, { draftHash: a.draftHash }, reviewer)).rejects.toMatchObject({ code: "approval_expired" });
    expect(h.db.action.rows[0].status).toBe("expired");
  });

  it("editing the draft invalidates approvals and the old hash", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await approve(a.id, { draftHash: a.draftHash }, reviewer);
    const oldHash = a.draftHash;
    const edited = await editDraft(a.id, "Second draft about widgets.", member);
    expect(edited?.status).toBe("awaiting_approval");
    expect(edited?.draftHash).not.toBe(oldHash);
    expect(h.db.approval.rows.filter((r) => r.decision === "invalidated")).toHaveLength(1);
    expect(h.db.approval.rows.filter((r) => r.decision === "pending")).toHaveLength(1);
    await expect(approve(a.id, { draftHash: oldHash as string }, reviewer)).rejects.toMatchObject({ code: "stale_draft" });
    const ok = await approve(a.id, { draftHash: edited!.draftHash as string }, reviewer);
    expect(ok.action.status).toBe("approved");
  });

  it("editing in a regulated claim blocks the action", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    const edited = await editDraft(a.id, "Guaranteed results, risk-free.", member);
    expect(edited?.status).toBe("blocked");
    expect(edited?.riskClass).toBe("D");
  });

  it("reject marks approvals rejected", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    const r = await reject(a.id, "not on brand", member);
    expect(r.status).toBe("rejected");
    expect(h.db.approval.rows[0].decision).toBe("rejected");
  });
});

describe("requestExecution", () => {
  it("refuses without an approval of the current hash", async () => {
    const a = seed({ status: "approved" });
    await expect(requestExecution(a.id, admin)).rejects.toMatchObject({ code: "approval_required" });
    expect(h.enqueued).toHaveLength(0);
  });

  it("enqueues with exec:<id>:<hash> idempotency key once approved", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await approve(a.id, { draftHash: a.draftHash }, reviewer);
    await requestExecution(a.id, admin);
    expect(h.enqueued[0]).toMatchObject({ kind: "execute_action", idempotencyKey: `exec:${a.id}:${a.draftHash}` });
  });

  it("honours the global kill switch and per-tenant switch", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await approve(a.id, { draftHash: a.draftHash }, reviewer);
    h.db.featureFlag.rows.push({ id: "f", key: "global.publishing", enabled: false });
    await expect(requestExecution(a.id, admin)).rejects.toMatchObject({ code: "publishing_paused" });
    h.db.featureFlag.rows.length = 0;
    h.db.organization.rows[0].publishingEnabled = false;
    await expect(requestExecution(a.id, admin)).rejects.toMatchObject({ code: "publishing_disabled" });
    h.db.organization.rows[0].publishingEnabled = true;
    h.db.featureFlag.rows.push({ id: "g", key: "action.update_meta_description", enabled: false });
    await expect(requestExecution(a.id, admin)).rejects.toMatchObject({ code: "action_type_disabled" });
  });

  it("returns manual instructions when no integration exists", async () => {
    const a = seed({ integrationId: null, status: "approved" });
    await expect(requestExecution(a.id, admin)).rejects.toMatchObject({ code: "manual_required" });
  });

  it("enforces tenant isolation", async () => {
    const a = seed();
    await expect(approve(a.id, { draftHash: a.draftHash }, { ...member, organizationId: "other" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("separation of duties", () => {
  const owner: SessionContext = { ...member, userId: "u9", email: "o@x.io", role: "owner" };
  const addMember = (userId: string, role: string) =>
    h.db.membership.rows.push({ id: `m-${userId}`, userId, organizationId: "o1", role, status: "active" });

  it("the requester cannot approve their own request", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await expect(approve(a.id, { draftHash: a.draftHash }, member)).rejects.toMatchObject({ status: 403, code: "separation_of_duties" });
    expect(h.db.action.rows[0].status).toBe("awaiting_approval");
    expect(h.db.auditLog.rows.some((r) => r.action === "action.approval_denied_self")).toBe(true);
  });

  it("the last editor cannot approve, even when someone else requested the review", async () => {
    const a = seed();
    await requestApproval(a.id, { organizationId: "o1", userId: null });
    const edited = await editDraft(a.id, "Edited by the reviewer.", reviewer);
    // The edit re-requests review as `reviewer`; a fresh system request still leaves them as last editor.
    h.db.approval.rows.forEach((r) => (r.requestedBy = null));
    await expect(approve(a.id, { draftHash: edited!.draftHash as string }, reviewer)).rejects.toMatchObject({ code: "separation_of_duties" });
    const ok = await approve(a.id, { draftHash: edited!.draftHash as string }, admin);
    expect(ok.action.status).toBe("approved");
  });

  it("a sole owner may self-approve, flagged self_approved in the audit log", async () => {
    addMember(owner.userId, "owner");
    addMember(member.userId, "member");
    const a = seed();
    await requestApproval(a.id, owner);
    const { action } = await approve(a.id, { draftHash: a.draftHash }, owner);
    expect(action.status).toBe("approved");
    const log = h.db.auditLog.rows.find((r) => r.action === "action.approved")!;
    expect(log.after).toMatchObject({ self_approved: true });
  });

  it("self-approval is refused once the org has a second owner/admin", async () => {
    addMember(owner.userId, "owner");
    addMember(admin.userId, "admin");
    const a = seed();
    await requestApproval(a.id, owner);
    await expect(approve(a.id, { draftHash: a.draftHash }, owner)).rejects.toMatchObject({ code: "separation_of_duties" });
  });

  it("a member never self-approves, even in a single-admin org", async () => {
    addMember(owner.userId, "owner");
    addMember(member.userId, "member");
    const a = seed();
    await requestApproval(a.id, member);
    await expect(approve(a.id, { draftHash: a.draftHash }, member)).rejects.toMatchObject({ code: "separation_of_duties" });
  });

  it("staff in support mode cannot self-approve", async () => {
    addMember(owner.userId, "owner");
    const staff: SessionContext = { userId: "s1", email: "staff@x.io", organizationId: "o1", role: "admin", staffMode: true };
    const a = seed();
    await requestApproval(a.id, staff);
    await expect(approve(a.id, { draftHash: a.draftHash }, staff)).rejects.toMatchObject({ code: "separation_of_duties" });
    expect(h.db.auditLog.rows.find((r) => r.action === "action.approval_requested")).toMatchObject({ actorType: "staff", actorId: "s1" });
  });
});

describe("execution permissions", () => {
  it("members cannot execute; admins can", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await approve(a.id, { draftHash: a.draftHash }, reviewer);
    await expect(requestExecution(a.id, member)).rejects.toMatchObject({ status: 403 });
    expect(h.enqueued).toHaveLength(0);
    await requestExecution(a.id, admin);
    expect(h.enqueued).toHaveLength(1);
  });

  it("staff support mode can execute and is audit-logged as staff", async () => {
    const a = seed();
    await requestApproval(a.id, member);
    await approve(a.id, { draftHash: a.draftHash }, reviewer);
    await requestExecution(a.id, { userId: "s1", email: "s@x.io", organizationId: "o1", role: "admin", staffMode: true });
    expect(h.db.auditLog.rows.find((r) => r.action === "action.execution_requested")).toMatchObject({ actorType: "staff" });
  });
});
