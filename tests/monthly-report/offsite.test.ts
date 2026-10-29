// Off-site work in the monthly report: filled from listOffsiteForPeriod for the report's UTC month,
// optional (null when nothing went live or the lookup fails) and rendered in the Markdown export.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as { projectId: string; organizationId: string; from: Date; to: Date }[],
  items: [] as Record<string, unknown>[],
  fail: false,
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findFirst: async () => ({ id: "p1", name: "Acme", websiteUrl: "https://www.acme.test", brandNames: ["Acme"], organization: { serviceTier: null } }),
    },
    visibilityRun: { findMany: async () => [], findFirst: async () => null },
    observation: { findMany: async () => [] },
    auditFinding: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/snapshots", () => ({
  getSnapshotAt: async () => null,
  listSnapshots: async () => [],
  compareSnapshots: async () => ({ notes: [] }),
}));
vi.mock("@/lib/tasks", () => ({ listShippedWork: async () => [], listOpenWork: async () => [] }));
vi.mock("@/lib/report/build", () => ({ buildSiteReport: async () => ({ issues: [] }) }));
vi.mock("@/lib/google/summary", () => ({ getSearchSummary: async () => ({ gsc: null, ga4: null }) }));
vi.mock("@/lib/providers/llm", () => ({ isLlmConfigured: () => false, generateStructured: async () => null }));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: async () => undefined }));
vi.mock("@/lib/offsite", () => ({
  listOffsiteForPeriod: async (projectId: string, organizationId: string, from: Date, to: Date) => {
    h.calls.push({ projectId, organizationId, from, to });
    if (h.fail) throw new Error("db down");
    return h.items;
  },
}));

import { buildMonthlyPayload } from "@/lib/monthly-report/generate";
import { monthlyReportToMarkdown } from "@/lib/monthly-report/markdown";

const NOW = new Date("2026-11-02T00:00:00Z");
const item = (name: string, type: string, url: string | null) => ({
  id: name, projectId: "p1", type, name, url, status: "live", napConsistent: null, source: "manual", taskId: null, notes: null,
  liveAt: "2026-10-12T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z",
});

beforeEach(() => {
  h.calls = [];
  h.items = [];
  h.fail = false;
});

describe("monthly report off-site work", () => {
  it("lists items that went live in the report's UTC month", async () => {
    h.items = [item("Justdial listing", "directory", "https://justdial.example/acme"), item("Local news feature", "pr_mention", null)];
    const p = await buildMonthlyPayload("p1", "o1", "2026-10", NOW);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.projectId).toBe("p1");
    expect(h.calls[0]!.organizationId).toBe("o1");
    expect(h.calls[0]!.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(h.calls[0]!.to.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(p.offsite).toEqual({
      count: 2,
      live: [
        { name: "Justdial listing", type: "directory", url: "https://justdial.example/acme" },
        { name: "Local news feature", type: "pr_mention" },
      ],
    });

    const md = monthlyReportToMarkdown(p, "Summary.");
    expect(md).toContain("## Off-site work");
    expect(md).toContain("2 off-site items went live this month.");
    expect(md).toContain("- Justdial listing (Directory listing) — https://justdial.example/acme");
    expect(md).toContain("- Local news feature (PR / press mention)");
  });

  it("is null when nothing went live, and the export omits the section", async () => {
    const p = await buildMonthlyPayload("p1", "o1", "2026-10", NOW);
    expect(p.offsite).toBeNull();
    expect(monthlyReportToMarkdown(p, "Summary.")).not.toContain("Off-site work");
  });

  it("never breaks the report when the lookup fails", async () => {
    h.fail = true;
    const p = await buildMonthlyPayload("p1", "o1", "2026-10", NOW);
    expect(p.offsite).toBeNull();
    expect(p.work.shipped).toEqual([]);
  });

  it("renders older payloads without an offsite field", async () => {
    const p = await buildMonthlyPayload("p1", "o1", "2026-10", NOW);
    delete (p as { offsite?: unknown }).offsite;
    expect(monthlyReportToMarkdown(p, "Summary.")).not.toContain("Off-site work");
  });
});
