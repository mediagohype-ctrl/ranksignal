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

import { concurrencyFor, createProviderLimiter, createUsageBatcher, visibilityJob } from "@/lib/visibility/job";
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

describe("per-provider limiter", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("runs every provider in parallel but never more than its own limit at once", async () => {
    const limits: Record<string, number> = { a: 2, b: 3 };
    const limiter = createProviderLimiter((k) => limits[k]);
    const peak: Record<string, number> = { a: 0, b: 0 };
    const now: Record<string, number> = { a: 0, b: 0 };
    let bothBusy = false;
    const job = (k: "a" | "b") =>
      limiter.run(k, async () => {
        now[k]++;
        peak[k] = Math.max(peak[k], now[k]);
        if (now.a > 0 && now.b > 0) bothBusy = true;
        await sleep(2 + Math.random() * 3);
        now[k]--;
        return k;
      });
    const out = await Promise.all([...Array.from({ length: 10 }, () => job("a")), ...Array.from({ length: 10 }, () => job("b"))]);
    expect(out).toHaveLength(20);
    expect(peak).toEqual({ a: 2, b: 3 });
    expect(bothBusy).toBe(true);
    expect(limiter.active("a") + limiter.active("b")).toBe(0);
  });

  it("frees the slot when a call throws", async () => {
    const limiter = createProviderLimiter(() => 1);
    await expect(limiter.run("x", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limiter.run("x", async () => "ok")).resolves.toBe("ok");
  });

  it("limits per provider id, falling back to the provider family, then the default", () => {
    expect(concurrencyFor("openrouter:anthropic/claude-opus-5.5")).toBe(3);
    expect(concurrencyFor("perplexity")).toBe(2);
    expect(concurrencyFor("unknown")).toBe(3);
    expect(concurrencyFor("x", { x: 0 })).toBe(1);
  });
});
