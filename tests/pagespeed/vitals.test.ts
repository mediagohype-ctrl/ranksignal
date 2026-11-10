import { describe, expect, it } from "vitest";
import { formatVital, pageVitals, rateVital, summarizeVitals, worstRating } from "@/lib/pagespeed/vitals";
import { parsePsiResponse, psiRequestUrl } from "@/lib/pagespeed/psi";
import { psiKeyPagesFor } from "@/lib/pagespeed/plan";
import type { AuditDepthData, PageSpeedRow } from "@/lib/pagespeed/types";

const row = (o: Partial<PageSpeedRow>): PageSpeedRow => ({
  url: "https://acme.example/", strategy: "mobile", status: "ok", isHome: true, performanceScore: 80,
  labLcpMs: null, labCls: null, labTbtMs: null, labFcpMs: null,
  fieldLcpMs: null, fieldInpMs: null, fieldCls: null, fieldFcpMs: null, fieldScope: null,
  error: null, fetchedAt: "2026-11-10T00:00:00Z", ...o,
});
const depth = (rows: PageSpeedRow[]): AuditDepthData => ({ status: "succeeded", finishedAt: null, probed: true, probes: [], sitemapNoindex: null, pageSpeed: rows });

describe("Core Web Vitals thresholds (Google's)", () => {
  it("rates LCP, INP and CLS at the documented boundaries", () => {
    expect(rateVital("lcp", 2500)).toBe("good");
    expect(rateVital("lcp", 2501)).toBe("needs_improvement");
    expect(rateVital("lcp", 4001)).toBe("poor");
    expect(rateVital("inp", 200)).toBe("good");
    expect(rateVital("inp", 501)).toBe("poor");
    expect(rateVital("cls", 0.1)).toBe("good");
    expect(rateVital("cls", 0.26)).toBe("poor");
    expect(rateVital("lcp", null)).toBeNull();
    expect(worstRating(["good", "poor", "needs_improvement"])).toBe("poor");
    expect(formatVital("lcp", 2400)).toMatch(/2\.4\s?s/);
  });

  it("prefers real-user (field) data over the lab test", () => {
    const v = pageVitals(row({ fieldScope: "url", fieldLcpMs: 1500, fieldInpMs: 150, fieldCls: 0.05, labLcpMs: 9000 }))!;
    expect(v.source).toBe("field");
    expect(v.lcp?.rating).toBe("good");
    expect(v.overall).toBe("good");
  });

  it("summarises pages and reports pending / unavailable honestly", () => {
    const s = summarizeVitals(depth([row({ labLcpMs: 1800, labCls: 0.02, labTbtMs: 100 }), row({ url: "https://acme.example/s", isHome: false, labLcpMs: 7000, labCls: 0.3, labTbtMs: 800 })]))!;
    expect(s).toMatchObject({ status: "measured", source: "lab", tested: 2, passing: 1 });
    expect(summarizeVitals(null)).toBeNull();
    expect(summarizeVitals({ ...depth([]), status: "running" })!.status).toBe("pending");
    expect(summarizeVitals(depth([row({ status: "failed", performanceScore: null })]))!.status).toBe("unavailable");
  });
});

describe("PageSpeed Insights client", () => {
  it("builds the request URL with the strategy and optional key", () => {
    const u = new URL(psiRequestUrl("https://acme.example/", "mobile", "k123"));
    expect(u.origin + u.pathname).toBe("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    expect(u.searchParams.get("url")).toBe("https://acme.example/");
    expect(u.searchParams.get("strategy")).toBe("mobile");
    expect(u.searchParams.get("key")).toBe("k123");
  });

  it("rejects responses without Lighthouse results", () => {
    expect("error" in parsePsiResponse({})).toBe(true);
    expect("error" in parsePsiResponse(null)).toBe(true);
  });

  it("gives each plan its number of tested key pages", () => {
    expect(psiKeyPagesFor("starter")).toBe(3);
    expect(psiKeyPagesFor("growth")).toBe(10);
    expect(psiKeyPagesFor("agency")).toBe(25);
    expect(psiKeyPagesFor("unknown")).toBeGreaterThanOrEqual(0);
  });
});
