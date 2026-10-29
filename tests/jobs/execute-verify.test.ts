// A pending ActionExecution (interrupted attempt) is verified against the live resource, never re-applied.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "../actions/fake-db";
import type { Connector, ConnectorResource } from "@/lib/types";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, connector: null as unknown as Connector }));
vi.mock("@/lib/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: async () => ({ id: "run", state: "queued" }) }));
vi.mock("@/lib/connectors/registry", () => ({ getConnectorForIntegration: async () => h.connector }));

import { executeActionJob, NeedsReviewError } from "@/lib/actions/job";
import { draftHash } from "@/lib/actions/hash";
import { POLICY_VERSION } from "@/lib/policy/engine";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import type { JobContext } from "@/lib/jobs/queue";

function connector(liveValue: string | null) {
  const calls = { apply: 0 };
  const c: Connector = {
    id: "fake",
    getCapabilities: () => WORDPRESS_CAPABILITIES,
    testConnection: async () => ({ ok: true }),
    listResources: async () => ({ items: [] }),
    getResource: async () =>
      liveValue === null ? null : ({ id: "pages:1", type: "page", url: "", version: "v2", fields: { meta_description: liveValue } } as ConnectorResource),
    createDraft: async () => ({ ok: false }),
    proposePatch: async (_id, ch) => ({ preview: ch.after, diff: "" }),
    applyPatch: async () => {
      calls.apply++;
      return { ok: true, newVersion: "v3" };
    },
    validateResource: async () => ({ status: "passed", detail: "ok" }),
    rollback: async () => ({ ok: true }),
    disconnect: async () => {},
  };
  return { c, calls };
}

function seed() {
  h.db.organization.rows.push({ id: "o1", publishingEnabled: true });
  h.db.project.rows.push({ id: "p1", organizationId: "o1", websiteUrl: "https://acme.example", settings: null });
  h.db.integration.rows.push({ id: "i1", organizationId: "o1", projectId: "p1", provider: "wordpress", credentialEncrypted: "v1:x", capabilities: WORDPRESS_CAPABILITIES });
  const base = {
    id: "a1", organizationId: "o1", projectId: "p1", type: "update_meta_description",
    target: { resourceType: "page", resourceId: "pages:1", url: "https://acme.example/blog/a" },
    proposedChange: { field: "meta_description", before: "Old description", after: "New widget description." },
    policyVersion: POLICY_VERSION, riskClass: "B", policyDecision: "approval_required", status: "executing",
    integrationId: "i1", rationale: "r",
  };
  const hash = draftHash(base as never);
  h.db.action.rows.push({ ...base, draftHash: hash });
  h.db.approval.rows.push({ id: "ap1", organizationId: "o1", actionId: "a1", draftHash: hash, decision: "approved", expiresAt: new Date(Date.now() + 1e9) });
  h.db.actionExecution.rows.push({
    id: "e1", organizationId: "o1", actionId: "a1", connector: "fake", idempotencyKey: `exec:a1:${hash}`, result: "pending",
    beforeState: { id: "pages:1", type: "page", url: "", version: "v1", fields: { meta_description: "Old description" } }, expectedVersion: "v1",
  });
  return hash;
}

const ctx = (input: Record<string, unknown>): JobContext => ({
  run: { id: "r1", organizationId: "o1", projectId: "p1", input, attempts: 2 },
  transition: async () => {},
  event: async () => {},
});

beforeEach(() => {
  h.db = createFakeDb();
});

describe("pending execution after a restart", () => {
  it("marks needs_review and never calls applyPatch when the live value differs", async () => {
    const hash = seed();
    const f = connector("Someone else's edit");
    h.connector = f.c;
    await expect(executeActionJob(ctx({ actionId: "a1", draftHash: hash }))).rejects.toBeInstanceOf(NeedsReviewError);
    expect(f.calls.apply).toBe(0);
    expect(h.db.actionExecution.rows[0]).toMatchObject({ result: "failure", rollbackStatus: "manual_required" });
    expect(h.db.action.rows[0].status).toBe("failed");
  });

  it("marks needs_review when the live resource can't be read", async () => {
    const hash = seed();
    const f = connector(null);
    h.connector = f.c;
    const err = await executeActionJob(ctx({ actionId: "a1", draftHash: hash })).catch((e) => e);
    expect((err as { errorClass?: string }).errorClass).toBe("needs_review");
    expect(f.calls.apply).toBe(0);
  });

  it("finishes as success without re-applying when the change is already live", async () => {
    const hash = seed();
    const f = connector("New widget description.");
    h.connector = f.c;
    const out = await executeActionJob(ctx({ actionId: "a1", draftHash: hash }));
    expect(out).toMatchObject({ status: "succeeded" });
    expect(f.calls.apply).toBe(0);
    expect(h.db.actionExecution.rows[0]).toMatchObject({ result: "success" });
  });
});
