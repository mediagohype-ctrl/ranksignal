// AI-written drafts are never auto-published: the analyze job forces approval_required for LLM text or
// LLM-flagged unsupported claims, even for allow-listed class B changes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./fake-db";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb & Record<string, unknown>,
  enqueued: [] as Record<string, unknown>[],
  llm: false,
  claims: [] as string[],
}));
vi.mock("@/lib/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/jobs/queue", () => ({
  enqueue: async (o: Record<string, unknown>) => {
    h.enqueued.push(o);
    return { id: `run-${h.enqueued.length}`, state: "queued" };
  },
}));
vi.mock("@/lib/billing/usage", () => ({
  reserveCredits: async () => undefined,
  releaseReservation: async () => undefined,
  recordUsage: async () => undefined,
}));
vi.mock("@/lib/providers/llm", () => ({
  isLlmConfigured: () => h.llm,
  generateStructured: async () => ({
    data: { metaDescription: "Industrial steel widgets built for heavy use, with fast delivery across India and expert support.", unsupportedClaims: h.claims, outline: [] },
    costMicros: 10,
  }),
}));

import { analyzeJob, enforceLlmReview } from "@/lib/recommendations/job";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import type { PolicyResult } from "@/lib/policy/engine";

function seed() {
  const db = createFakeDb() as FakeDb & Record<string, unknown>;
  for (const k of ["auditFinding", "crawlPage", "visibilityRun", "observation"]) {
    (db as Record<string, unknown>)[k] = (createFakeDb() as unknown as Record<string, unknown>).action;
  }
  h.db = db;
  db.organization.rows.push({ id: "o1", publishingEnabled: true });
  db.project.rows.push({
    id: "p1", organizationId: "o1", name: "Acme", websiteUrl: "https://acme.example", brandNames: ["Acme"],
    settings: { automation: { allowClassB: ["update_meta_description"] } },
  });
  db.integration.rows.push({ id: "i1", organizationId: "o1", projectId: "p1", provider: "wordpress", credentialEncrypted: "v1:x", capabilities: WORDPRESS_CAPABILITIES });
  (db.crawlPage as FakeDb["action"]).rows.push({
    id: "cp1", organizationId: "o1", url: "https://acme.example/blog/widgets", finalUrl: null,
    extracted: { title: "Widgets", description: null, h1: ["Steel widgets"], textSample: "Steel widgets built for heavy industrial use. More text follows here." },
  });
  (db.auditFinding as FakeDb["action"]).rows.push({
    id: "f1", organizationId: "o1", projectId: "p1", status: "open", code: "missing_meta_description", severity: "medium",
    category: "metadata", message: "No meta description.", pageUrl: "https://acme.example/blog/widgets", evidence: {}, crawlPageId: "cp1",
  });
}

const ctx = () => ({
  run: { id: "run1", organizationId: "o1", projectId: "p1", input: {} },
  transition: async () => undefined,
  event: async () => undefined,
}) as unknown as Parameters<typeof analyzeJob>[0];

const metaAction = () => h.db.action.rows.find((a) => a.type === "update_meta_description")!;

beforeEach(() => {
  h.enqueued = [];
  h.llm = false;
  h.claims = [];
  seed();
});

describe("enforceLlmReview", () => {
  const auto: PolicyResult = { riskClass: "B", decision: "auto_execute", reason: "allow-listed" } as PolicyResult;
  it("forces approval for AI text or flagged claims, leaves deterministic and blocked drafts alone", () => {
    expect(enforceLlmReview(auto, { llmWritten: false, unsupportedClaims: 0 })).toBe(auto);
    expect(enforceLlmReview(auto, { llmWritten: true, unsupportedClaims: 0 }).decision).toBe("approval_required");
    expect(enforceLlmReview(auto, { llmWritten: false, unsupportedClaims: 2 }).decision).toBe("approval_required");
    const blocked = { ...auto, decision: "blocked" } as PolicyResult;
    expect(enforceLlmReview(blocked, { llmWritten: true, unsupportedClaims: 1 }).decision).toBe("blocked");
  });
});

describe("analyze job routing", () => {
  it("baseline: a deterministic allow-listed class B draft auto-executes", async () => {
    await analyzeJob(ctx());
    expect(metaAction().policyDecision).toBe("auto_execute");
    expect(h.enqueued.some((e) => e.kind === "execute_action")).toBe(true);
  });

  it("an LLM-written draft is routed to approval and never auto-executed", async () => {
    h.llm = true;
    await analyzeJob(ctx());
    const a = metaAction();
    expect((a.proposedChange as { after: string }).after).toContain("Industrial steel widgets");
    expect(a.policyDecision).toBe("approval_required");
    expect(a.status).toBe("awaiting_approval");
    expect(h.enqueued.some((e) => e.kind === "execute_action")).toBe(false);
  });

  it("LLM-flagged unsupported claims also force approval", async () => {
    h.llm = true;
    h.claims = ["fast delivery across India"];
    await analyzeJob(ctx());
    expect(metaAction().policyDecision).toBe("approval_required");
    expect(h.enqueued.some((e) => e.kind === "execute_action")).toBe(false);
  });
});
