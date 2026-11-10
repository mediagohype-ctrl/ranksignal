// The daily sync keeps up to QUERY_TOP_N queries per day (Keywords page long tail) while pages stay at TOP_N.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google/api", () => ({
  gscQuery: async (_t: string, _s: string, body: { dimensions: string[]; startRow?: number }) => {
    if ((body.startRow ?? 0) > 0) return [];
    if (body.dimensions.length === 1) return [{ keys: ["2026-11-01"], clicks: 1, impressions: 10, position: 3 }];
    return Array.from({ length: 1200 }, (_, i) => ({ keys: ["2026-11-01", `${body.dimensions[1]}-${i}`], clicks: 1200 - i, impressions: 5000, position: 5 }));
  },
  ga4RunReport: async () => ({}),
}));

import { QUERY_TOP_N, TOP_N, fetchGscMetrics } from "@/lib/google/sync";

describe("GSC query cap", () => {
  it("stores more query rows than page rows per day", async () => {
    const rows = await fetchGscMetrics("token", "sc-domain:acme.test", { startDate: "2026-11-01", endDate: "2026-11-01" });
    expect(QUERY_TOP_N).toBeGreaterThan(TOP_N);
    expect(rows.filter((r) => r.dimension === "query")).toHaveLength(QUERY_TOP_N);
    expect(rows.filter((r) => r.dimension === "page")).toHaveLength(TOP_N);
    expect(rows.filter((r) => r.dimension === "query")[0].key).toBe("query-0");
  });
});
