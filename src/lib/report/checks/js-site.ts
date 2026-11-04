// "AI tools can't read your site because it needs JavaScript" (check seo.js_rendering).
// When the site is an empty JavaScript shell, the page-content checks only repeat that one cause (no main heading,
// same Google headline everywhere, too little text…). They are switched to "not measured" — out of the score and the
// problem list — and this single check + problem takes their place. Detection: src/lib/crawler/js-site.ts.
import type { Pillar, ReportIssue } from "@/lib/report/types";
import { makeCheck, okPages, plural, urlOf, type CheckContext, type EvaluatedCheck, type ReportFinding } from "@/lib/report/inputs";
import {
  detectJsOnlySite, isShellPage, JS_SITE_CHECK_ID, JS_SITE_FINDING_CODE, JS_SYMPTOM_CHECKS, JS_SYMPTOM_FINDINGS,
  type JsSiteDetection,
} from "@/lib/crawler/js-site";

export const JS_SUPPRESSED_DETAIL =
  "Can't be checked yet: your pages are empty until JavaScript runs. Fix “AI tools can't read your site” first.";

/** Stored detection from the crawl (it may include a real-browser comparison), else the HTML heuristic. */
export function jsSiteDetection(ctx: CheckContext): JsSiteDetection {
  return ctx.jsSite ?? detectJsOnlySite(ctx.pages);
}

export function jsSiteCheck(ctx: CheckContext, js: JsSiteDetection): EvaluatedCheck | null {
  if (!js.detected) return null;
  const ok = okPages(ctx.pages);
  const shells = ok.filter((p) => isShellPage(p.extracted!));
  const total = Math.max(js.totalPages, ok.length, 1);
  const count = Math.max(shells.length, js.shellPages);
  return makeCheck("seo", JS_SITE_CHECK_ID, "Pages readable without JavaScript", 8, {
    score: Math.min(20, 100 * (1 - count / total)),
    status: "fail",
    detail: `${count} of ${plural(total, "page")} we checked arrive empty — the words only appear after JavaScript runs.`,
    affected: shells.length ? shells.map(urlOf) : js.examples,
    affectedCount: count,
    evidence: js.method === "rendered" && js.rendered?.[0]
      ? `${js.rendered[0].url}: ${js.rendered[0].rawWords} words as it arrives, ${js.rendered[0].renderedWords} words after JavaScript runs.`
      : js.appRoot
        ? `Your pages load an empty “${js.appRoot}” box and fill it with JavaScript.`
        : undefined,
    facts: { shellPages: count, total, method: js.method, appRoot: js.appRoot, sameTitleShare: js.sameTitleShare },
  });
}

/** Switch the symptom checks to "not measured" and add the one JavaScript check. Returns new arrays. */
export function applyJsSite(byPillar: Record<Pillar, EvaluatedCheck[]>, check: EvaluatedCheck | null): Record<Pillar, EvaluatedCheck[]> {
  if (!check) return byPillar;
  const out = {} as Record<Pillar, EvaluatedCheck[]>;
  for (const [p, checks] of Object.entries(byPillar) as [Pillar, EvaluatedCheck[]][]) {
    out[p] = checks.map((c) =>
      JS_SYMPTOM_CHECKS.has(c.id) && c.status !== "not_measured"
        ? { ...c, status: "not_measured" as const, score: 0, detail: JS_SUPPRESSED_DETAIL, affectedUrls: [], affectedCount: 0, evidence: undefined }
        : c,
    );
  }
  out[check.pillar] = [check, ...out[check.pillar]];
  return out;
}

/** Findings left for the generic problem list: the JavaScript finding is the check itself; symptoms are hidden. */
export function jsFilteredFindings(findings: ReportFinding[], detected: boolean): ReportFinding[] {
  return findings.filter((f) => f.code !== JS_SITE_FINDING_CODE && !(detected && JS_SYMPTOM_FINDINGS.has(f.code)));
}

export function jsSiteIssue(c: EvaluatedCheck): ReportIssue {
  const n = typeof c.facts.shellPages === "number" ? c.facts.shellPages : c.affectedCount;
  const total = typeof c.facts.total === "number" ? c.facts.total : n;
  return {
    id: c.id.replace(/\./g, "-"),
    pillar: c.pillar,
    title: "AI tools can't read your site because it needs JavaScript",
    whatsWrong:
      `${n} of ${plural(total, "page")} we checked arrive empty: the words only appear after JavaScript runs in the visitor's browser. ` +
      "People see your site normally, but Google and AI tools that read the page as it arrives see a blank page.",
    whyItMatters:
      "ChatGPT, Perplexity and most other AI tools don't run JavaScript, so they can't read, quote or recommend you. Google can, but slowly and not always. " +
      "Until this is fixed we can't check your headings, Google headlines or amount of text, so we've left those out of your score.",
    howToFix: [
      "Ask your web developer to make every page arrive with its words already in it. This is called server-side rendering or pre-rendering.",
      "Built with Next.js: make pages server components — remove \"use client\" from the page files and keep it only in small interactive parts.",
      "Built with React (Vite or Create React App): pre-render every page when the site is built (for example vite-plugin-ssr / Vike, vite-react-ssg or react-snap), or move the site to Next.js.",
      "Built with Vue or Angular: switch on Nuxt server rendering, or Angular SSR / prerendering.",
      "When it's live, open a page, press Ctrl+U and check that you can read your text in the code. Then click \"Check website\" again.",
    ],
    impact: "high",
    effort: "involved",
    affectedUrls: c.affectedUrls,
    affectedCount: c.affectedCount,
    evidence: c.evidence,
    relatedActionType: "internal_task",
  };
}
