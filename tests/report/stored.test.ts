// Stored reports: GET paths read ReportSnapshot.report and never call the LLM; build.ts only generates the
// summary when asked (snapshot writer) and attributes usage to the backend actually used.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  snapshot: null as null | { report: unknown; createdAt: Date },
  latestCrawl: null as null | { id: string },
  latestVis: null as null | { finishedAt: Date | null },
  crawlPageArgs: [] as unknown[],
  usage: [] as { provider: string }[],
}));

const generateStructured = vi.hoisted(() => vi.fn(async () => ({ data: { summary: "A plain summary of the site written from computed facts only." }, costMicros: 42 })));

vi.mock("@/lib/providers/llm", () => ({
  generateStructured,
  isLlmConfigured: () => true,
  getLlmBackend: () => "openrouter",
}));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: async (_o: string, u: { provider: string }) => void h.usage.push(u) }));
vi.mock("@/lib/report/site-data", () => ({ getCrawlSiteContext: async () => null }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("@/lib/db", () => ({
  db: {
    reportSnapshot: { findFirst: async () => h.snapshot },
    project: {
      findFirst: async () => ({ id: "p1", organizationId: "o1", name: "Acme", websiteUrl: "https://acme.example", brandNames: ["Acme"], competitors: [] }),
    },
    crawlRun: {
      findFirst: async (a: { select?: unknown }) =>
        a.select ? h.latestCrawl : h.latestCrawl && { id: h.latestCrawl.id, pagesCrawled: 0, pagesFound: 0, finishedAt: new Date(), createdAt: new Date() },
    },
    visibilityRun: { findFirst: async () => h.latestVis },
    auditFinding: { findMany: async () => [] },
    crawlPage: {
      findMany: async (a: unknown) => {
        h.crawlPageArgs.push(a);
        return [];
      },
    },
    observation: { findMany: async () => [] },
  },
}));

import { buildSiteReport } from "@/lib/report/build";
import { getStoredReport, isSiteReport } from "@/lib/report/stored";

const storedReport = (crawlRunId: string) => ({
  projectId: "p1", brand: "Acme", websiteUrl: "https://acme.example", generatedAt: "2026-10-29T00:00:00.000Z",
  crawl: { crawlRunId, pagesCrawled: 10, finishedAt: null }, overall: { score: 70, grade: "C", headline: "" },
  pillars: [], issues: [], quickWins: [], strengths: [], aiVisibility: { measured: false }, executiveSummary: "STORED",
  executiveSummarySource: "llm", limitations: [], methodologyVersion: "x",
});

beforeEach(() => {
  generateStructured.mockClear();
  h.snapshot = null;
  h.latestCrawl = { id: "c1" };
  h.latestVis = null;
  h.crawlPageArgs = [];
  h.usage = [];
});

describe("getStoredReport", () => {
  it("prefers the stored report and makes no LLM call", async () => {
    h.snapshot = { report: storedReport("c1"), createdAt: new Date() };
    const r = await getStoredReport("p1", "o1");
    expect(r?.executiveSummary).toBe("STORED");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("falls back to a template-only build when nothing is stored — still no LLM call", async () => {
    const r = await getStoredReport("p1", "o1");
    expect(r?.executiveSummarySource).toBe("template");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("ignores a stored report older than the latest crawl or AI check", async () => {
    h.snapshot = { report: storedReport("c0"), createdAt: new Date("2026-10-01") };
    expect((await getStoredReport("p1", "o1"))?.executiveSummary).not.toBe("STORED");
    h.snapshot = { report: storedReport("c1"), createdAt: new Date("2026-10-01") };
    h.latestVis = { finishedAt: new Date("2026-10-02") };
    expect((await getStoredReport("p1", "o1"))?.executiveSummary).not.toBe("STORED");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON blobs", () => {
    expect(isSiteReport({ foo: 1 })).toBe(false);
    expect(isSiteReport(storedReport("c1"))).toBe(true);
  });
});

describe("GET /api/projects/[id]/report", () => {
  it("serves the stored report (json and markdown) without calling the LLM", async () => {
    vi.doMock("@/lib/api", async (orig) => ({
      ...(await orig<typeof import("@/lib/api")>()),
      requireSession: async () => ({ organizationId: "o1", userId: "u1", role: "viewer" }),
      requireProject: async () => ({ id: "p1", name: "Acme Site" }),
    }));
    const { GET } = await import("@/app/api/projects/[id]/report/route");
    h.snapshot = { report: storedReport("c1"), createdAt: new Date() };
    const res = await GET(new Request("http://x/api/projects/p1/report"), { params: Promise.resolve({ id: "p1" }) });
    expect(((await res.json()) as { item: { executiveSummary: string } }).item.executiveSummary).toBe("STORED");
    const md = await GET(new Request("http://x/api/projects/p1/report?format=markdown"), { params: Promise.resolve({ id: "p1" }) });
    expect(md.headers.get("Content-Type")).toMatch(/markdown/);
    expect(generateStructured).not.toHaveBeenCalled();
  });
});

describe("buildSiteReport", () => {
  it("never calls the LLM unless asked, and loads only the needed page columns", async () => {
    await buildSiteReport("p1", "o1");
    expect(generateStructured).not.toHaveBeenCalled();
    const args = h.crawlPageArgs[0] as { select: Record<string, unknown> };
    expect(args.select).toBeDefined();
    expect(args.select).not.toHaveProperty("html");
  });

  it("generates the summary when asked and records usage under the backend actually used", async () => {
    const r = await buildSiteReport("p1", "o1", { llmSummary: true });
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(r.executiveSummarySource).toBe("llm");
    expect(h.usage).toEqual([expect.objectContaining({ provider: "openrouter", taskType: "llm_analysis" })]);
  });
});
