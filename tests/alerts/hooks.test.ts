import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ throwIt: false, delivered: 0 }));

vi.mock("@/lib/alerts/evaluate", () => {
  const result = async () => {
    if (state.throwIt) throw new Error("db down");
    return {
      config: (await import("@/lib/alerts/config")).DEFAULT_ALERT_CONFIG,
      project: { id: "p1", name: "Shop" },
      candidates: [{ rule: "site_down", dedupeKey: "site", severity: "urgent", title: "t", body: "b", link: "/x" }],
    };
  };
  return { evaluateAfterCrawl: vi.fn(result), evaluateAfterVisibility: vi.fn(result), evaluateAfterSearchSync: vi.fn(result) };
});
vi.mock("@/lib/alerts/deliver", () => ({ deliverAlerts: vi.fn(async (_c: unknown, list: unknown[]) => (state.delivered += list.length)) }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { alertsAfterCrawl, alertsAfterGoogleSync, alertsAfterVisibility } from "@/lib/alerts/hooks";

beforeEach(() => {
  state.throwIt = false;
  state.delivered = 0;
});

describe("alert hooks", () => {
  it("evaluate and deliver after each kind of run", async () => {
    expect(await alertsAfterCrawl({ organizationId: "o", projectId: "p1", crawlRunId: "c" })).toBe(1);
    expect(await alertsAfterVisibility({ organizationId: "o", projectId: "p1", visibilityRunId: "v" })).toBe(2);
  });

  it("never throw (a broken alert must not fail the run)", async () => {
    state.throwIt = true;
    await expect(alertsAfterCrawl({ organizationId: "o", projectId: "p1", crawlRunId: "c" })).resolves.toBe(0);
  });

  it("only Search Console syncs trigger the clicks rule", async () => {
    expect(await alertsAfterGoogleSync({ organizationId: "o", projectId: "p1", source: "ga4" })).toBe(0);
    expect(await alertsAfterGoogleSync({ organizationId: "o", projectId: null, source: "gsc" })).toBe(0);
    expect(await alertsAfterGoogleSync({ organizationId: "o", projectId: "p1", source: "gsc" })).toBe(1);
  });
});
