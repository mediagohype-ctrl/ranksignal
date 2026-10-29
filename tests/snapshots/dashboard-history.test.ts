// The overview trend must show the NEWEST runs (asc + take returned the oldest 200 once a project had more).
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ args: null as null | { orderBy: unknown; take: number } }));
vi.mock("@/lib/db", () => ({
  db: {
    visibilityRun: {
      findMany: async (a: { orderBy: { createdAt: string }; take: number }) => {
        h.args = a;
        // 300 runs exist; the DB returns the newest `take`, newest first.
        const all = Array.from({ length: 300 }, (_, i) => ({ id: `v${i}`, createdAt: new Date(2026, 0, 1, 0, i) }));
        const sorted = a.orderBy.createdAt === "desc" ? [...all].reverse() : all;
        return sorted.slice(0, a.take);
      },
    },
  },
}));
vi.mock("@/lib/actions/service", () => ({ appliedChangeWhere: () => ({}) }));

import { HISTORY_LIMIT, loadRecentVisibilityRuns } from "@/lib/dashboard/data";

describe("loadRecentVisibilityRuns", () => {
  it("takes the latest runs and returns them oldest → newest", async () => {
    const rows = await loadRecentVisibilityRuns("o1", "p1");
    expect(h.args).toMatchObject({ orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT });
    expect(rows).toHaveLength(200);
    expect(rows.at(-1)!.id).toBe("v299");
    expect(rows[0].id).toBe("v100");
  });
});
