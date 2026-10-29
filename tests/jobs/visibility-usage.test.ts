import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ providerCtx: null as null | Record<string, unknown> }));
vi.mock("@/lib/db", () => ({
  db: {
    visibilityRun: { findFirst: async () => ({ id: "v1", projectId: "p1", status: "queued", providers: null }), update: async () => ({}) },
    project: { findFirst: async () => ({ id: "p1", organizationId: "o1", name: "Acme", websiteUrl: "https://acme.example", brandNames: ["Acme"], competitors: [] }) },
    organization: { findUnique: async () => ({ id: "o1", planId: "starter", serviceTier: "grow" }) },
    trackedPrompt: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/billing/ai-limits", () => ({ getRunPromptCap: async () => 50 }));
vi.mock("@/lib/providers/visibility/registry", () => ({
  getAvailableProviders: async (ctx: Record<string, unknown>) => {
    h.providerCtx = ctx;
    return [];
  },
}));
vi.mock("@/lib/snapshots", () => ({ writeSnapshot: async () => {} }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: async () => ({}) }));

import { createUsageBatcher, visibilityJob } from "@/lib/visibility/job";
import { getEngineLimit } from "@/lib/billing/plans";

describe("usage batching", () => {
  it("records every N answers and the remainder on flush, without losing spend on a failed write", async () => {
    const writes: { provider: string; credits: number; costMicros: number }[] = [];
    let failNext = false;
    const b = createUsageBatcher(async (provider, u) => {
      if (failNext) {
        failNext = false;
        throw new Error("db down");
      }
      writes.push({ provider, ...u });
    }, 3);
    for (let i = 0; i < 3; i++) await b.add("openai", 1, 10);
    expect(writes).toEqual([{ provider: "openai", credits: 3, costMicros: 30 }]);
    failNext = true;
    for (let i = 0; i < 3; i++) await b.add("openai", 1, 10); // this batch's write fails → kept pending
    await b.add("gemini", 1, 5);
    await b.flush();
    const total = writes.reduce((a, w) => a + w.credits, 0);
    expect(total).toBe(7);
    expect(writes.reduce((a, w) => a + w.costMicros, 0)).toBe(65);
  });
});

describe("engine limit", () => {
  it("caps providers by plan / service tier", async () => {
    const ctx = { run: { id: "r", organizationId: "o1", projectId: "p1", input: { visibilityRunId: "v1" }, attempts: 1 }, transition: async () => {}, event: async () => {} };
    await expect(visibilityJob(ctx)).rejects.toThrow();
    expect(h.providerCtx?.maxProviders).toBe(getEngineLimit("starter", "grow"));
  });
});
