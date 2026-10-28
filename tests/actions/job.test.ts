import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./fake-db";
import type { Connector, ConnectorResource, ProposedChange } from "@/lib/types";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, connector: null as unknown as Connector }));
vi.mock("@/lib/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: async () => ({ id: "run", state: "queued" }) }));
vi.mock("@/lib/connectors/registry", () => ({ getConnectorForIntegration: async () => h.connector }));

import { executeActionJob, rollbackJob } from "@/lib/actions/job";
import { draftHash } from "@/lib/actions/hash";
import { POLICY_VERSION } from "@/lib/policy/engine";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import { createManualConnector } from "@/lib/connectors/manual";
import type { JobContext } from "@/lib/jobs/queue";

function fakeConnector(opts: { breakValidation?: boolean } = {}) {
  const state = { value: "Old description", version: "v1" };
  const calls = { apply: 0, rollback: 0 };
  const res = (): ConnectorResource => ({ id: "pages:1", type: "page", url: "https://acme.example/blog/a", version: state.version, fields: { meta_description: state.value } });
  const c: Connector = {
    id: "fake",
    getCapabilities: () => WORDPRESS_CAPABILITIES,
    testConnection: async () => ({ ok: true }),
    listResources: async () => ({ items: [] }),
    getResource: async () => res(),
    createDraft: async () => ({ ok: false }),
    proposePatch: async (_id, ch) => ({ preview: ch.after, diff: "" }),
    applyPatch: async (_id, ch: ProposedChange, expected) => {
      calls.apply++;
      if (expected && expected !== state.version) return { ok: false, error: "conflict" };
      state.value = opts.breakValidation ? "mangled" : ch.after;
      state.version = `v${Number(state.version.slice(1)) + 1}`;
      return { ok: true, newVersion: state.version };
    },
    validateResource: async (_id, ch) => (state.value === ch.after ? { status: "passed", detail: "ok" } : { status: "failed", detail: "mismatch" }),
    rollback: async (_id, before) => {
      calls.rollback++;
      state.value = before.fields.meta_description ?? "";
      return { ok: true };
    },
    disconnect: async () => {},
  };
  return { c, state, calls };
}

function ctxFor(input: Record<string, unknown>) {
  const events: string[] = [];
  const states: string[] = [];
  const ctx: JobContext = {
    run: { id: "r1", organizationId: "o1", projectId: "p1", input, attempts: 1 },
    transition: async (to, name) => {
      states.push(to);
      events.push(name);
    },
    event: async (name) => void events.push(name),
  };
  return { ctx, events, states };
}

function seedApproved() {
  h.db.organization.rows.push({ id: "o1", publishingEnabled: true });
  h.db.project.rows.push({ id: "p1", organizationId: "o1", websiteUrl: "https://acme.example", settings: null });
  h.db.integration.rows.push({ id: "i1", organizationId: "o1", projectId: "p1", provider: "wordpress", credentialEncrypted: "v1:x", capabilities: WORDPRESS_CAPABILITIES });
  const base = {
    id: "a1", organizationId: "o1", projectId: "p1", type: "update_meta_description",
    target: { resourceType: "page", resourceId: "pages:1", url: "https://acme.example/blog/a" },
    proposedChange: { field: "meta_description", before: "Old description", after: "New widget description." },
    policyVersion: POLICY_VERSION, riskClass: "B", policyDecision: "approval_required", status: "approved",
    integrationId: "i1", rationale: "r",
  };
  const hash = draftHash(base as never);
  h.db.action.rows.push({ ...base, draftHash: hash });
  h.db.approval.rows.push({ id: "ap1", organizationId: "o1", actionId: "a1", draftHash: hash, decision: "approved", expiresAt: new Date(Date.now() + 1e9) });
  return hash;
}

beforeEach(() => {
  h.db = createFakeDb();
});

describe("executeActionJob", () => {
  it("applies once, validates, and is idempotent on re-run", async () => {
    const hash = seedApproved();
    const f = fakeConnector();
    h.connector = f.c;
    const run1 = ctxFor({ actionId: "a1", draftHash: hash });
    const out = await executeActionJob(run1.ctx);
    expect(out).toMatchObject({ status: "succeeded" });
    expect(f.calls.apply).toBe(1);
    expect(run1.states).toEqual(["executing", "validating", "succeeded"]);
    expect(run1.events).toContain("action.execution_started");
    expect(run1.events).toContain("action.validation_passed");
    expect(run1.events).toContain("action.remeasure_scheduled");
    expect(h.db.action.rows[0].status).toBe("succeeded");
    const exec = h.db.actionExecution.rows[0];
    expect(exec).toMatchObject({ idempotencyKey: `exec:a1:${hash}`, result: "success", validation: "passed", expectedVersion: "v1" });
    expect((exec.beforeState as ConnectorResource).fields.meta_description).toBe("Old description");

    const run2 = ctxFor({ actionId: "a1", draftHash: hash });
    const out2 = await executeActionJob(run2.ctx);
    expect(out2).toMatchObject({ deduplicated: true });
    expect(f.calls.apply).toBe(1);
    expect(h.db.actionExecution.rows).toHaveLength(1);
  });

  it("resumes a pending execution by checking live state instead of re-applying", async () => {
    const hash = seedApproved();
    const f = fakeConnector();
    f.state.value = "New widget description."; // previous attempt landed before crash
    h.connector = f.c;
    h.db.actionExecution.rows.push({
      id: "e1", organizationId: "o1", actionId: "a1", connector: "fake", idempotencyKey: `exec:a1:${hash}`, result: "pending",
      beforeState: { id: "pages:1", type: "page", url: "", version: "v1", fields: { meta_description: "Old description" } }, expectedVersion: "v1",
    });
    const out = await executeActionJob(ctxFor({ actionId: "a1", draftHash: hash }).ctx);
    expect(out).toMatchObject({ status: "succeeded" });
    expect(f.calls.apply).toBe(0);
  });

  it("blocks when the draft hash changed after approval", async () => {
    seedApproved();
    const f = fakeConnector();
    h.connector = f.c;
    const r = ctxFor({ actionId: "a1", draftHash: "f".repeat(64) });
    const out = await executeActionJob(r.ctx);
    expect(out).toMatchObject({ blocked: true });
    expect(f.calls.apply).toBe(0);
    expect(r.states).toEqual(["blocked"]);
  });

  it("blocks under the global kill switch", async () => {
    const hash = seedApproved();
    h.db.featureFlag.rows.push({ id: "f", key: "global.publishing", enabled: false });
    const f = fakeConnector();
    h.connector = f.c;
    const out = await executeActionJob(ctxFor({ actionId: "a1", draftHash: hash }).ctx);
    expect(out).toMatchObject({ blocked: true, code: "publishing_paused" });
    expect(f.calls.apply).toBe(0);
  });

  it("rolls back when validation fails", async () => {
    const hash = seedApproved();
    const f = fakeConnector({ breakValidation: true });
    h.connector = f.c;
    const r = ctxFor({ actionId: "a1", draftHash: hash });
    const out = await executeActionJob(r.ctx);
    expect(out).toMatchObject({ status: "rolled_back" });
    expect(f.calls.rollback).toBe(1);
    expect(f.state.value).toBe("Old description");
    expect(r.events).toEqual(expect.arrayContaining(["action.validation_failed", "action.rollback_started", "action.rolled_back"]));
    expect(h.db.action.rows[0].status).toBe("rolled_back");
    expect(h.db.actionExecution.rows[0]).toMatchObject({ result: "failure", rollbackStatus: "rolled_back" });
  });

  it("records a conflict as failed without retrying the write", async () => {
    const hash = seedApproved();
    const f = fakeConnector();
    h.connector = { ...f.c, getResource: async () => ({ id: "pages:1", type: "page", url: "", version: "v1", fields: { meta_description: "Old description" } }), applyPatch: async () => ({ ok: false, error: "conflict" }) };
    const out = await executeActionJob(ctxFor({ actionId: "a1", draftHash: hash }).ctx);
    expect(out).toMatchObject({ ok: false, error: "conflict" });
    expect(h.db.action.rows[0].status).toBe("failed");
    expect(h.db.notification.rows.length).toBeGreaterThan(0);
  });

  it("a manual connector never yields success", async () => {
    const hash = seedApproved();
    h.connector = { ...createManualConnector({ type: "update_meta_description" }), getCapabilities: () => WORDPRESS_CAPABILITIES, getResource: async () => ({ id: "pages:1", type: "page", url: "", version: "v1", fields: {} }) };
    const r = ctxFor({ actionId: "a1", draftHash: hash });
    const out = await executeActionJob(r.ctx);
    expect(out).toMatchObject({ ok: false, error: "manual_required" });
    expect(h.db.action.rows[0].status).not.toMatch(/succeeded/);
    expect(r.states).not.toContain("succeeded");
  });
});

describe("rollbackJob", () => {
  it("restores the before-state of the latest execution", async () => {
    const hash = seedApproved();
    const f = fakeConnector();
    h.connector = f.c;
    await executeActionJob(ctxFor({ actionId: "a1", draftHash: hash }).ctx);
    expect(f.state.value).toBe("New widget description.");
    const out = await rollbackJob(ctxFor({ actionId: "a1" }).ctx);
    expect(out).toMatchObject({ status: "rolled_back" });
    expect(f.state.value).toBe("Old description");
    expect(h.db.action.rows[0].status).toBe("rolled_back");
  });
});
