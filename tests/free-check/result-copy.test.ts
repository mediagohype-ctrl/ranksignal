// Free-check result rules from the site audit (15 Nov 2026): fixes ordered by points, one page count per fix,
// "0 of 7 pass. 3 matter most.", no "Waiting for AI results", share links, and Hindi for the result.
import { describe, expect, it } from "vitest";
import type { SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { SafeFetchError } from "@/lib/crawler/safe-fetch";
import type { IssueImpact, SiteReport } from "@/lib/report/types";
import { ISSUE_COPY_IDS } from "@/lib/report/issues";
import { pillarSummary } from "@/lib/report/score";
import { rankIssuesByPoints, shownAffectedCount, titlePageCount, trimReport } from "@/lib/free-check/trim";
import { runFreeCheck } from "@/lib/free-check/run";
import { freeCheckStrings } from "@/lib/free-check/strings";
import { HI_FIXES, HI_FIXES_NOT_NEEDED, hindiFix } from "@/lib/free-check/hi-fixes";
import { addWebsiteHref, freeCheckLink, linkedinShareHref, resultHost, signupHref, whatsappShareHref } from "@/lib/free-check/share";
import { BAD_PAGE, GOOD_HOME, ORIGIN } from "../report/fixtures";

function report(issues: { id: string; title?: string; impact?: IssueImpact; affectedCount?: number }[]): SiteReport {
  return {
    projectId: "free-check",
    brand: "X",
    websiteUrl: "https://x.example/",
    generatedAt: "2026-11-15T00:00:00.000Z",
    crawl: { crawlRunId: "free-check", pagesCrawled: 5, finishedAt: null },
    overall: { score: 61, grade: "D", headline: "" },
    pillars: [
      {
        pillar: "seo",
        label: "SEO",
        score: 60,
        grade: "D",
        summary: "Needs work: 1 of 3 pass. 1 matters most.",
        checks: [
          { id: "seo.a", pillar: "seo", label: "A", status: "pass", score: 100, weight: 1, detail: "" },
          { id: "seo.b", pillar: "seo", label: "B", status: "fail", score: 0, weight: 1, detail: "" },
          { id: "seo.c", pillar: "seo", label: "C", status: "warn", score: 50, weight: 1, detail: "" },
          { id: "seo.d", pillar: "seo", label: "D", status: "not_measured", score: 0, weight: 5, detail: "" },
        ],
      },
      { pillar: "aeo", label: "AEO", score: 50, grade: "D", summary: "x", checks: [] },
      {
        pillar: "geo",
        label: "GEO",
        score: 40,
        grade: "F",
        summary: "Poor: 0 of 2 pass. 2 matter most. Waiting for AI results — this score covers your website only.",
        partial: true,
        checks: [
          { id: "geo.a", pillar: "geo", label: "A", status: "fail", score: 0, weight: 1, detail: "" },
          { id: "geo.b", pillar: "geo", label: "B", status: "fail", score: 0, weight: 1, detail: "" },
        ],
      },
      { pillar: "brand", label: "Brand", score: null, grade: null, summary: "Not checked yet.", checks: [] },
    ],
    issues: issues.map((i) => ({
      id: i.id,
      pillar: "seo" as const,
      title: i.title ?? `Issue ${i.id}`,
      whatsWrong: "wrong",
      whyItMatters: "matters",
      howToFix: ["one", "two", "three"],
      impact: i.impact ?? "medium",
      effort: "quick" as const,
      affectedUrls: [],
      affectedCount: i.affectedCount ?? 0,
    })),
    quickWins: [],
    strengths: [],
    aiVisibility: {} as SiteReport["aiVisibility"],
    executiveSummary: "",
    executiveSummarySource: "template",
    limitations: [],
    methodologyVersion: "report-1",
  };
}

const opts = { brand: "X", pagesChecked: ["https://x.example/"] };

describe("top fixes are ordered by points, biggest first", () => {
  // Ids without a matching check get the estimate for their impact: high 3, medium 2, low 1.
  const r = report([
    { id: "finding-one", impact: "low" },
    { id: "finding-two", impact: "high" },
    { id: "finding-three", impact: "medium" },
    { id: "finding-four", impact: "high" },
    { id: "finding-five", impact: "low" },
  ]);

  it("ranks every problem by its points and keeps the report's order for ties", () => {
    expect(rankIssuesByPoints(r).map((x) => [x.issue.id, x.points])).toEqual([
      ["finding-two", 3],
      ["finding-four", 3],
      ["finding-three", 2],
      ["finding-one", 1],
      ["finding-five", 1],
    ]);
  });

  it("the free result shows the three biggest, in falling order of points", () => {
    const t = trimReport(r, opts);
    expect(t.issues.map((i) => i.id)).toEqual(["finding-two", "finding-four", "finding-three"]);
    const points = t.issues.map((i) => i.points ?? 0);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(t.totalIssues).toBe(5);
  });

  it("lists the next problems by title only (no fix steps) and counts every problem by impact", () => {
    const t = trimReport(r, opts);
    expect(t.moreIssues?.map((i) => i.id)).toEqual(["finding-one", "finding-five"]);
    expect(t.moreIssues?.[0]).not.toHaveProperty("howToFix");
    expect(t.moreIssues?.[0]).not.toHaveProperty("whatsWrong");
    expect(t.issueCounts).toEqual({ high: 2, medium: 1, low: 2 });
  });

  it("a fix tied to a scored check is ranked by what fixing that check adds", () => {
    // seo-b fails outright (score 0), seo-c only warns (score 50): fixing b must add more, so it comes first
    // even though the report lists c first.
    const t = trimReport(report([{ id: "seo-c" }, { id: "seo-b" }]), opts);
    expect(t.issues.map((i) => i.id)).toEqual(["seo-b", "seo-c"]);
    expect(t.issues[0].points!).toBeGreaterThan(t.issues[1].points!);
  });
});

describe("one page count per fix", () => {
  it("reads the page count a title names", () => {
    expect(titlePageCount("Google summary missing on 4 pages — Google shows random text from the page instead")).toBe(4);
    expect(titlePageCount("1 page is hidden from Google")).toBe(1);
    expect(titlePageCount("2 key pages don't explain what you offer")).toBe(2);
    expect(titlePageCount("Your site has no page list for Google")).toBeNull();
    expect(titlePageCount("3 images have no image description")).toBeNull();
  });

  it("the Affects line uses the title's number (audit: 'on 4 pages' next to 'Affects 5 pages')", () => {
    expect(shownAffectedCount({ title: "Google summary missing on 4 pages — Google shows random text from the page instead", affectedCount: 5 })).toBe(4);
    expect(shownAffectedCount({ title: "Main heading missing on 2 pages", affectedCount: 4 })).toBe(2);
    // No page count in the title: the check's own count stands.
    expect(shownAffectedCount({ title: "Your site has no page list for Google", affectedCount: 0 })).toBe(0);
    expect(shownAffectedCount({ title: "3 images have no image description", affectedCount: 2 })).toBe(2);
  });

  it("title count === affected count for every fix in a trimmed result", () => {
    const t = trimReport(
      report([
        { id: "finding-a", title: "Google summary missing on 4 pages — Google shows random text from the page instead", affectedCount: 5, impact: "high" },
        { id: "finding-b", title: "Google headline too long on 1 page — Google cuts it off", affectedCount: 3, impact: "high" },
        { id: "finding-c", title: "Main heading missing on 2 pages", affectedCount: 4, impact: "high" },
      ]),
      opts,
    );
    expect(t.issues).toHaveLength(3);
    for (const i of t.issues) expect(i.affectedCount).toBe(titlePageCount(i.title));
  });

  it("holds for a real check run (homepage + key pages with problems)", async () => {
    const ok = (url: string, body: string, type = "text/html"): SafeFetchResult => ({ finalUrl: url, status: 200, headers: new Headers({ "content-type": type }), body, redirectChain: [] });
    const fetcher = async (url: string) => {
      if (url === `${ORIGIN}/`) return ok(url, GOOD_HOME);
      if (url === `${ORIGIN}/robots.txt`) return ok(url, "User-agent: *\nAllow: /\n", "text/plain");
      if (url === `${ORIGIN}/sitemap.xml` || url === `${ORIGIN}/llms.txt`) return { ...ok(url, "nf"), status: 404 };
      if (url === "http://acme.example/") return { ...ok(`${ORIGIN}/`, GOOD_HOME), redirectChain: [url] };
      if (url.startsWith(ORIGIN)) return ok(url, BAD_PAGE(new URL(url).pathname));
      throw new SafeFetchError("blocked", "off-site");
    };
    const r = await runFreeCheck(`${ORIGIN}/`, { fetcher });
    expect(r.issues.length).toBeGreaterThan(0);
    for (const i of r.issues) {
      const inTitle = titlePageCount(i.title);
      if (inTitle !== null) expect(i.affectedCount).toBe(inTitle);
    }
    const points = r.issues.map((i) => i.points ?? 0);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    // The free check never asks AI, so no score line may say it is waiting for AI.
    for (const p of r.pillars) expect(p.summary).not.toMatch(/waiting/i);
  });
});

describe("score lines", () => {
  const checks = (pass: number, fail: number, warn = 0) => [
    ...Array.from({ length: pass }, (_, i) => ({ id: `p${i}`, pillar: "aeo" as const, label: "", status: "pass" as const, score: 100, weight: 1, detail: "" })),
    ...Array.from({ length: fail }, (_, i) => ({ id: `f${i}`, pillar: "aeo" as const, label: "", status: "fail" as const, score: 0, weight: 1, detail: "" })),
    ...Array.from({ length: warn }, (_, i) => ({ id: `w${i}`, pillar: "aeo" as const, label: "", status: "warn" as const, score: 50, weight: 1, detail: "" })),
  ];

  it("says '0 of 7 pass. 3 matter most.' and keeps the grammar right for 1", () => {
    expect(pillarSummary("aeo", 20, checks(0, 3, 4))).toBe("Poor: 0 of 7 pass. 3 matter most.");
    expect(pillarSummary("aeo", 60, checks(1, 1))).toBe("Needs work: 1 of 2 pass. 1 matters most.");
    expect(pillarSummary("aeo", 100, checks(1, 0))).toBe("Good: 1 of 1 pass.");
  });

  it("the result's own line (from the counts) matches, in English and Hindi", () => {
    const en = freeCheckStrings("en");
    expect(en.pillarSummary("poor", 0, 7, 3)).toBe("Poor: 0 of 7 pass. 3 matter most.");
    expect(en.pillarSummary("ok", 1, 2, 1)).toBe("Needs work: 1 of 2 pass. 1 matters most.");
    expect(en.pillarSummary("good", 7, 7, 0)).toBe("Good: 7 of 7 pass.");
    const hi = freeCheckStrings("hi");
    expect(hi.pillarSummary("poor", 0, 7, 3)).toBe("कमज़ोर: 7 में से 0 जाँच पास। 3 सबसे ज़रूरी हैं।");
    expect(hi.pillarSummary("ok", 1, 2, 1)).toBe("सुधार चाहिए: 2 में से 1 जाँच पास। 1 सबसे ज़रूरी है।");
  });

  it("trimmed pillars carry the counts and never say 'Waiting for AI results'", () => {
    const t = trimReport(report([]), opts);
    const seo = t.pillars[0];
    expect(seo.counts).toEqual({ pass: 1, total: 3, fail: 1 }); // the not-measured check is left out
    expect(seo.summary).toBe("Needs work: 1 of 3 pass. 1 matters most.");
    const geo = t.pillars[2];
    expect(geo.counts).toEqual({ pass: 0, total: 2, fail: 2 });
    expect(geo.summary).toBe("Poor: 0 of 2 pass. 2 matter most.");
    expect(t.pillars[3].summary).toMatch(/full check/i);
    expect(JSON.stringify(t)).not.toMatch(/Waiting for AI/i);
  });
});

describe("result wording", () => {
  const en = freeCheckStrings("en");
  const hi = freeCheckStrings("hi");

  it("names the overall score the way the pricing card does (Found Score)", () => {
    expect(en.overallLabel).toBe("Your Found Score");
    expect(en.eyebrow("acme.example")).toContain("Found Score");
    expect(hi.overallLabel).toContain("Found Score");
  });

  it("the trial heading carries the real number of fixes", () => {
    expect(en.seeAllTitle(12, 7)).toBe("See all 12 fixes free for 7 days");
    expect(en.seeAllTitle(1, 7)).toBe("See the full fix free for 7 days");
    expect(en.seeAllTitle(0, 7)).toBe("See the full check free for 7 days");
    expect(hi.seeAllTitle(12, 7)).toContain("12");
  });

  it("locked ChatGPT box, team card and fix order use the audit's words", () => {
    expect(`${en.lockedTitle} ${en.lockedBody(7)}`).toBe("What does ChatGPT say about you? See it free for 7 days.");
    expect(en.teamTitle).toBe("Too busy to fix this? Our team will do it for you.");
    expect(en.bookCall).toBe("Book a free call");
    expect(en.addToAccount).toBe("Add to my account");
    expect(en.fixesIntro).not.toMatch(/most useful/i);
    expect(en.run).toBe("Check my website free");
  });

  it("no result string says 'waiting'", () => {
    for (const s of [en, hi]) {
      const flat = Object.values(s).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "object" ? Object.values(v as Record<string, string>) : []));
      expect(flat.some((v) => /waiting/i.test(v))).toBe(false);
    }
  });

  it("Hindi has every string English has, and the fixed strings are in Hindi", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    const devanagari = /[ऀ-ॿ]/;
    const latinOnly = new Set(["overallName", "emailPlaceholder", "basedOnFor", "waPlaceholder"]);
    for (const [k, v] of Object.entries(hi)) {
      if (typeof v === "string" && !latinOnly.has(k)) expect(devanagari.test(v), k).toBe(true);
    }
    expect(devanagari.test(hi.fixesTitle(3))).toBe(true);
    expect(devanagari.test(hi.affects(4))).toBe(true);
    expect(devanagari.test(hi.serverError("unreachable") ?? "")).toBe(true);
    expect(devanagari.test(hi.serverError("something_new") ?? "")).toBe(true);
  });

  it("every error has a next step", () => {
    expect(en.emailInvalid).toMatch(/try again/i);
    expect(en.emailFailed).toMatch(/try again.*free trial/i);
    expect(en.emailNetwork).toMatch(/try again/i);
    expect(en.errGeneric).toMatch(/try again/i);
  });
});

describe("share links", () => {
  it("links back to the free check for the same website, per language", () => {
    expect(resultHost("https://www.gohypemedia.com/")).toBe("gohypemedia.com");
    expect(freeCheckLink("https://mywebrank.tech/", "https://www.gohypemedia.com/")).toBe("https://mywebrank.tech/free-check?url=gohypemedia.com");
    expect(freeCheckLink("https://mywebrank.tech", "https://gohypemedia.com/", "hi")).toBe("https://mywebrank.tech/hi/free-check?url=gohypemedia.com");
  });

  it("puts the score and the link in the ready-typed message", () => {
    const link = freeCheckLink("https://mywebrank.tech", "https://gohypemedia.com/");
    const msg = freeCheckStrings("en").shareMessage("gohypemedia.com", 61, "MyWebRank", link);
    expect(msg).toContain("61/100");
    expect(msg).toContain(link);
    expect(decodeURIComponent(whatsappShareHref(msg).split("text=")[1])).toBe(msg);
    expect(whatsappShareHref(msg).startsWith("https://wa.me/?text=")).toBe(true);
    expect(linkedinShareHref(msg).startsWith("https://www.linkedin.com/")).toBe(true);
    expect(decodeURIComponent(linkedinShareHref(msg).split("text=")[1])).toBe(msg);
    // A site we could not score is shared without a made-up number.
    expect(freeCheckStrings("en").shareMessage("x.example", null, "MyWebRank", link)).not.toMatch(/\d+\/100/);
  });

  it("carries the website to sign-up, or to the new-website flow for signed-in visitors", () => {
    expect(signupHref("https://acme.example/")).toBe("/signup?website=https%3A%2F%2Facme.example%2F");
    expect(addWebsiteHref("https://acme.example/")).toBe("/app/onboarding?website=https%3A%2F%2Facme.example%2F");
  });
});

describe("Hindi fixes", () => {
  const devanagari = /[ऀ-ॿ]/;

  it("covers every fix the free check can return", () => {
    const ids = ISSUE_COPY_IDS.map((id) => id.replace(/\./g, "-"));
    const missing = ids.filter((id) => !HI_FIXES[id] && !(HI_FIXES_NOT_NEEDED as readonly string[]).includes(id));
    expect(missing).toEqual([]);
    expect(HI_FIXES["seo-js_rendering"]).toBeDefined();
    // Nothing translated for a fix that no longer exists.
    expect(Object.keys(HI_FIXES).filter((id) => id !== "seo-js_rendering" && !ids.includes(id))).toEqual([]);
  });

  it("every Hindi fix has a title, a what's-wrong line and two first steps, in Hindi", () => {
    for (const [id, f] of Object.entries(HI_FIXES)) {
      expect(devanagari.test(f.title(3)), id).toBe(true);
      expect(devanagari.test(f.title(0)), id).toBe(true);
      expect(f.title(0), id).not.toMatch(/^0 /);
      expect(devanagari.test(f.what), id).toBe(true);
      expect(f.steps.length, id).toBe(2);
      for (const s of f.steps) expect(devanagari.test(s), id).toBe(true);
    }
  });

  it("uses the same page count as the English fix and never shows more steps than it", () => {
    const fix = hindiFix({ id: "seo-meta_description", title: "Google summary missing on 4 pages", whatsWrong: "x", howToFix: ["a"], affectedCount: 4 });
    expect(fix.translated).toBe(true);
    expect(fix.title).toContain("4 पेज");
    expect(fix.howToFix).toHaveLength(1);
  });

  it("falls back to the English text for a fix with no Hindi", () => {
    const en = { id: "finding-something-new", title: "T", whatsWrong: "W", howToFix: ["a", "b"], affectedCount: 0 };
    expect(hindiFix(en)).toEqual({ title: "T", whatsWrong: "W", howToFix: ["a", "b"], translated: false });
  });
});
