// Tenant scoping: every query the portfolio and link loaders run is filtered by the caller's organisation.
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { model: string; op: string; args: unknown }[] = [];
const rawSql: unknown[] = [];

function model(name: string, results: Record<string, unknown> = {}) {
  const rec = (op: string) => async (args: unknown) => {
    calls.push({ model: name, op, args });
    return results[op] ?? (op === "findFirst" ? null : op === "count" ? 0 : []);
  };
  return { findMany: rec("findMany"), findFirst: rec("findFirst"), groupBy: rec("groupBy"), count: rec("count") };
}

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  get db() {
    return h.db;
  },
}));

import { loadPortfolio } from "@/lib/portfolio/server";
import { loadLinkData } from "@/lib/links/server";

beforeEach(() => {
  calls.length = 0;
  rawSql.length = 0;
  h.db = {
    project: model("project", { findMany: [{ id: "p1", name: "Acme", websiteUrl: "https://acme.example", createdAt: new Date() }] }),
    crawlRun: model("crawlRun", { findFirst: { id: "cr1", finishedAt: new Date(), createdAt: new Date(), pagesCrawled: 2 } }),
    crawlPage: model("crawlPage"),
    visibilityRun: model("visibilityRun"),
    monthlyReport: model("monthlyReport"),
    task: model("task"),
    $queryRaw: async (q: unknown) => {
      rawSql.push(q);
      return [];
    },
  };
});

function orgOf(args: unknown): unknown {
  return (args as { where?: { organizationId?: unknown } })?.where?.organizationId;
}

describe("portfolio loader", () => {
  it("scopes every query to the organisation and batches (no per-project queries)", async () => {
    const data = await loadPortfolio("org-1");
    expect(data.rows).toHaveLength(1);
    expect(calls.length).toBe(6);
    for (const c of calls) expect(orgOf(c.args)).toBe("org-1");
    expect(rawSql).toHaveLength(1);
    const sql = rawSql[0] as { values: unknown[]; strings: string[] };
    expect(sql.strings.join("?")).toContain('"organizationId" =');
    expect(sql.values).toContain("org-1");
  });
});

describe("link loader", () => {
  it("scopes crawl, pages and tasks to the organisation", async () => {
    const res = await loadLinkData({ organizationId: "org-2" }, { id: "p9", websiteUrl: "https://acme.example", brandNames: ["Acme"], name: "Acme" });
    expect(res.report?.pagesAnalysed).toBe(0);
    expect(calls.map((c) => c.model).sort()).toEqual(["crawlPage", "crawlRun", "task"]);
    for (const c of calls) expect(orgOf(c.args)).toBe("org-2");
    const crawl = calls.find((c) => c.model === "crawlRun")!.args as { where: { projectId: string } };
    expect(crawl.where.projectId).toBe("p9");
    const pages = calls.find((c) => c.model === "crawlPage")!.args as { where: { crawlRunId: string } };
    expect(pages.where.crawlRunId).toBe("cr1");
  });
});
