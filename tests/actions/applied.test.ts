import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./fake-db";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock("@/lib/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: async () => ({ id: "run-1", state: "queued" }) }));

import { completeManually, isAppliedChange } from "@/lib/actions/service";
import { initialActionStatus } from "@/lib/recommendations/job";
import type { SessionContext } from "@/lib/types";

const admin: SessionContext = { userId: "u1", email: "a@x.io", organizationId: "o1", role: "admin" };
const member: SessionContext = { ...admin, userId: "u2", role: "member" };

function seed(over: Record<string, unknown> = {}) {
  const action = {
    id: "a1", organizationId: "o1", projectId: "p1", type: "content_brief", target: { url: "https://acme.example/faq" },
    proposedChange: null, riskClass: "A", policyDecision: "auto_execute", status: "proposed", integrationId: null, rationale: "r", ...over,
  };
  h.db.action.rows.push(action);
  return action;
}

beforeEach(() => {
  h.db = createFakeDb();
});

describe("class A briefs are not applied changes", () => {
  it("auto_execute recommendations start as proposed (never succeeded)", () => {
    expect(initialActionStatus("auto_execute")).toBe("proposed");
    expect(initialActionStatus("approval_required")).toBe("awaiting_approval");
    expect(initialActionStatus("blocked")).toBe("blocked");
  });

  it("only applied statuses with a successful execution count as applied", () => {
    expect(isAppliedChange({ status: "proposed", executions: [] })).toBe(false);
    // legacy class A brief that older versions auto-marked "succeeded" without executing anything
    expect(isAppliedChange({ status: "succeeded", executions: [] })).toBe(false);
    expect(isAppliedChange({ status: "succeeded", executions: [{ result: "success" }] })).toBe(true);
    expect(isAppliedChange({ status: "completed_manually", executions: [{ result: "success" }] })).toBe(true);
    expect(isAppliedChange({ status: "rolled_back", executions: [{ result: "success" }] })).toBe(false);
  });
});

describe("completeManually", () => {
  it("marks a manual-only action done with a manual execution and an audit log", async () => {
    seed();
    const { action, execution } = await completeManually("a1", { note: "Published the FAQ page", url: "https://acme.example/faq" }, admin);
    expect(action.status).toBe("completed_manually");
    expect(execution).toMatchObject({ connector: "manual", result: "success", actionId: "a1" });
    expect((execution.resultDetail as { note: string }).note).toBe("Published the FAQ page");
    expect(h.db.auditLog.rows.at(-1)).toMatchObject({ action: "action.completed_manually", resourceId: "a1" });
    expect(isAppliedChange({ status: String(action.status), executions: h.db.actionExecution.rows as unknown as { result: string }[] })).toBe(true);
  });

  it("allows staff support mode on blocked actions", async () => {
    seed({ riskClass: "D", policyDecision: "blocked", status: "blocked", integrationId: "i1" });
    const { action } = await completeManually("a1", {}, { ...member, role: "admin", staffMode: true });
    expect(action.status).toBe("completed_manually");
    expect(h.db.auditLog.rows.at(-1)).toMatchObject({ actorType: "staff" });
  });

  it("rejects members, auto-applicable actions and finished actions", async () => {
    seed({ riskClass: "B", policyDecision: "approval_required", status: "approved", integrationId: "i1" });
    await expect(completeManually("a1", {}, member)).rejects.toMatchObject({ status: 403 });
    await expect(completeManually("a1", {}, admin)).rejects.toMatchObject({ code: "auto_apply_available" });
    h.db.action.rows[0].status = "succeeded";
    await expect(completeManually("a1", {}, admin)).rejects.toMatchObject({ code: "invalid_state" });
  });
});
