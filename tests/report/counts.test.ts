// One problem count everywhere, one "biggest fix" rule, titles that match their page badge, and report text that is
// true for the data used (audit 15 Nov 2026: fix 9, bug 9, bug 10, item 3, item 12).
import { describe, expect, it } from "vitest";
import { composeReport } from "@/lib/report/compose";
import { buildIssues } from "@/lib/report/issues";
import { issueCounts } from "@/lib/report/issues";
import { makeCheck } from "@/lib/report/inputs";
import {
  biggestFix, changeLine, compareBiggestFix, placesLine, problemChange, problemCounts, problemCountsFromSnapshot, problemsLine, rankedFixes,
  sortByBiggestFix,
} from "@/lib/report/counts";
import { pagesReadNote, presentReport, reportHeadline, reportLimitations, speedLimitation } from "@/lib/report/present";
import { templateSummary } from "@/lib/report/summary";
import type { ReportIssue, SiteReport } from "@/lib/report/types";
import { ARTICLE, BAD_PAGE, GOOD_HOME, ctx, page } from "./fixtures";

const pages = [page("/", GOOD_HOME), page("/services", BAD_PAGE("/services")), page("/team", BAD_PAGE("/team")), page("/blog/why-pipes-burst", ARTICLE)];
const base = { projectId: "p1", brand: "Acme Plumbing", websiteUrl: "https://acme.example/", generatedAt: new Date("2026-10-28T00:00:00Z") };
const report = composeReport({ ...base, crawl: { crawlRunId: "c1", pagesCrawled: 4, pagesFound: 4, finishedAt: new Date() }, ctx: ctx(pages) });

const issue = (over: Partial<ReportIssue>): ReportIssue => ({
  id: "x", pillar: "seo", title: "T", whatsWrong: "", whyItMatters: "", howToFix: [], impact: "medium", effort: "moderate",
  affectedUrls: [], affectedCount: 1, ...over,
});

describe("problemCounts — the ONE definition", () => {
  it("counts problem types, splits by priority, and keeps places separate", () => {
    const c = problemCounts({
      issues: [issue({ impact: "high", affectedCount: 23 }), issue({ impact: "medium", affectedCount: 6 }), issue({ impact: "low", affectedCount: 0 })],
      crawl: { pagesCrawled: 29 },
    });
    expect(c).toEqual({ problems: 3, urgent: 1, important: 1, niceToHave: 1, places: 30, pages: 29 });
    expect(problemsLine(c)).toBe("3 problems: 1 urgent, 1 important, 1 nice to have");
    expect(placesLine(c)).toBe("across 30 places");
    expect(problemsLine(problemCounts(null))).toBe("No problems to fix");
  });

  it("the report, its history row (issueCounts) and the snapshot reader agree", () => {
    const fromReport = problemCounts(report);
    const fromSnapshot = problemCountsFromSnapshot(issueCounts(report.issues), report.crawl.pagesCrawled)!;
    expect(fromSnapshot).toEqual(fromReport);
    // A history row from before "places" existed still reads the same headline numbers.
    const legacy = problemCountsFromSnapshot({ critical: 1, high: 4, medium: 6, low: 2, info: 0, total: 13 })!;
    expect(legacy).toMatchObject({ problems: 13, urgent: 5, important: 6, niceToHave: 2, places: null });
  });

  it("the report summary uses the same number and words as everywhere else", () => {
    const c = problemCounts(report);
    expect(templateSummary(report)).toContain(`We found ${c.problems} problems to fix`);
    expect(templateSummary(report)).not.toMatch(/things? to improve/);
  });
});

describe("problem titles use the same page count as their badge", () => {
  const check = (id: string, facts: Record<string, number>, affected: number) =>
    makeCheck("seo", id, id, 1, { score: 10, detail: "d", affected: Array.from({ length: affected }, (_, i) => `https://a.example/${i}`), facts });

  it.each([
    ["seo.titles", { missing: 2, duplicate: 3, short: 0, long: 18, total: 30 }, 23],
    ["seo.titles", { missing: 0, duplicate: 0, short: 0, long: 5, total: 30 }, 5],
    ["seo.h1", { missing: 6, multiple: 17, total: 30 }, 23],
    ["seo.h1", { missing: 6, multiple: 0, total: 30 }, 6],
    ["seo.meta_description", { missing: 4, duplicate: 2, long: 3, total: 30 }, 9],
    ["seo.indexability", { errors: 2, noindex: 1, total: 30 }, 3],
    ["aeo.structured_data", { valid: 10, invalid: 2, total: 30 }, 20],
  ])("%s %j", (id, facts, affected) => {
    const [i] = buildIssues([check(id, facts, affected)]);
    const n = /(\d+) pages?\b/.exec(i.title);
    expect(n, i.title).not.toBeNull();
    expect(Number(n![1])).toBe(i.affectedCount);
  });

  it("holds for every problem of a real report that names a page count", () => {
    for (const i of report.issues) {
      const n = /(\d+) (?:key )?pages?\b/.exec(i.title);
      if (n) expect(Number(n[1]), i.title).toBe(i.affectedCount);
    }
  });
});

describe("biggest fix — one rule for Home and the Full report", () => {
  it("most points first; ties go to the quicker fix", () => {
    const items = [
      { title: "a", points: 3, minutes: 15 },
      { title: "b", points: 5, minutes: 240 },
      { title: "c", points: 5, minutes: 60 },
    ];
    expect(sortByBiggestFix(items).map((x) => x.title)).toEqual(["c", "b", "a"]);
    expect(compareBiggestFix(items[0], items[0])).toBe(0);
  });

  it("the report headline names the same fix Home lists first", () => {
    const top = biggestFix(report)!;
    expect(reportHeadline(report)).toContain(`Biggest fix: ${top.title.replace(/\.$/, "")}`);
    expect(report.overall.headline).toBe(reportHeadline(report));
    const ranked = rankedFixes(report);
    for (let k = 1; k < ranked.length; k++) expect(compareBiggestFix(ranked[k - 1], ranked[k])).toBeLessThanOrEqual(0);
  });

  it("a stored report gets today's headline when shown", () => {
    const stale = { ...report, overall: { ...report.overall, headline: "Old headline" } } as SiteReport;
    expect(presentReport(stale).overall.headline).toBe(reportHeadline(report));
  });
});

describe("limitations tell the truth about page speed and pages read", () => {
  const measured = {
    status: "measured", source: "lab", pages: [], origin: null, testedAt: null, tested: 3, passing: 1, failed: 0,
  } as NonNullable<SiteReport["coreWebVitals"]>;

  it("drops the 'estimated from page size' line when Google PageSpeed was used", () => {
    const r = { limitations: ["Page speed is estimated from page size and scripts (a proxy) — use Google PageSpeed Insights for a real speed test."], coreWebVitals: measured };
    const out = reportLimitations(r);
    expect(out.join(" ")).not.toMatch(/estimated from page size/);
    expect(out[0]).toMatch(/measured by Google PageSpeed Insights on 3 pages/);
    expect(speedLimitation({})).toMatch(/estimated from page size/);
  });

  it("says why pages were not read", () => {
    expect(pagesReadNote({ crawled: 250, found: 400, limit: 250 })).toMatch(/your plan reads up to 250 pages/);
    const below = pagesReadNote({ crawled: 64, found: 111, limit: 250, skipped: { filter: 30, account: 2, duplicate: 5 } })!;
    expect(below).toMatch(/We read 64 of the 111 addresses/);
    expect(below).toMatch(/not reached your plan's limit of 250 pages/);
    expect(below).toMatch(/30 filter or sort links/);
    expect(pagesReadNote({ crawled: 10, found: 10, limit: 250 })).toBeNull();
    // An old stored line is rewritten when shown.
    expect(reportLimitations({ limitations: ["We checked 64 of at least 111 pages we found (scan limit 250). Key pages were checked first."] })[0]).toMatch(
      /not reached your plan's limit/,
    );
  });
});

describe("change between two checks", () => {
  it("counts problem types fixed and new, with the score", () => {
    const c = problemChange(
      { issues: [{ id: "a" }, { id: "b" }, { id: "c" }], score: 49 },
      { issues: [{ id: "c" }, { id: "d" }], score: 52 },
    );
    expect(c).toEqual({ fixed: 2, added: 1, scoreBefore: 49, scoreAfter: 52 });
    expect(changeLine(c)).toBe("2 problems fixed, 1 new. Score 49 → 52.");
    expect(changeLine({ fixed: 0, added: 0, scoreBefore: 49, scoreAfter: 49 })).toBe("Same problems as last time. Score stayed at 49.");
  });
});
