// Pure: SiteReport → FreeCheckResult (what an anonymous visitor sees).
import type { ReportIssue, SiteReport } from "@/lib/report/types";
import { pointsForIssue } from "@/lib/report/points";
import { pillarSummary } from "@/lib/report/score";
import { AI_VISIBILITY_NOTE, FREE_PILLAR_NAMES, type FreeCheckResult } from "@/lib/free-check/types";

/** The free result shows the top 3 fixes; the rest are counted and shown blurred. */
export const FREE_MAX_ISSUES = 3;
export const FREE_MAX_FIX_STEPS = 2;
export const FREE_MAX_STRENGTHS = 5;
export const FREE_MAX_CHECKS_PER_PILLAR = 6;

const STATUS_ORDER: Record<string, number> = { fail: 0, warn: 1, pass: 2 };

/**
 * Every problem with its "+N points", biggest first. The free result says "biggest first", so the order must
 * follow the number people see. Ties keep the report's own order (urgent first, then quickest to do).
 * This is the one place the top fixes are chosen: the result page, the lead note and the emails all read it.
 */
export function rankIssuesByPoints(report: Pick<SiteReport, "overall" | "pillars" | "issues">): { issue: ReportIssue; points: number }[] {
  return report.issues
    .map((issue, order) => ({ issue, order, points: pointsForIssue(report, issue) }))
    .sort((a, b) => b.points - a.points || a.order - b.order)
    .map(({ issue, points }) => ({ issue, points }));
}

/** The page count a fix title names ("Google summary missing on 4 pages…" → 4, "1 key page doesn't…" → 1); null when it names none. */
export function titlePageCount(title: string): number | null {
  const m = /(\d+) (?:key )?pages?\b/.exec(title);
  return m ? Number(m[1]) : null;
}

/**
 * One page count per fix. A check's own count covers every page it flagged (for Google summaries: missing,
 * copied AND too long), while its title counts only the main problem (missing or copied), so the two could
 * disagree ("on 4 pages" next to "Affects 5 pages"). The free result has no page list, so it shows the
 * title's number in both places.
 */
export function shownAffectedCount(issue: Pick<ReportIssue, "title" | "affectedCount">): number {
  return titlePageCount(issue.title) ?? issue.affectedCount;
}

export function trimReport(report: SiteReport, o: { brand: string | null; pagesChecked: string[] }): FreeCheckResult {
  return {
    url: report.websiteUrl,
    brand: o.brand,
    checkedAt: report.generatedAt,
    pagesChecked: o.pagesChecked,
    overall: { ...report.overall },
    pillars: report.pillars.map((p) => {
      const measured = p.checks.filter((c) => c.status !== "not_measured");
      return {
        pillar: p.pillar,
        label: FREE_PILLAR_NAMES[p.pillar] ?? p.label,
        score: p.score,
        grade: p.grade,
        // Built without the app's "Waiting for AI results" note: the free check never asks AI, so nothing is on its way.
        summary:
          p.score === null
            ? p.pillar === "brand" || p.pillar === "geo"
              ? "Shown in the full check — we ask ChatGPT, Gemini and others about you after you sign up."
              : "We couldn't measure this from the pages we read."
            : pillarSummary(p.pillar, p.score, p.checks),
        counts: {
          pass: measured.filter((c) => c.status === "pass").length,
          total: measured.length,
          fail: measured.filter((c) => c.status === "fail").length,
        },
        checks: measured
          .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.weight - a.weight)
          .slice(0, FREE_MAX_CHECKS_PER_PILLAR),
      };
    }),
    issues: rankIssuesByPoints(report)
      .slice(0, FREE_MAX_ISSUES)
      .map(({ issue: i, points }) => ({
        id: i.id,
        pillar: i.pillar,
        pillarLabel: FREE_PILLAR_NAMES[i.pillar] ?? "Website",
        title: i.title,
        whatsWrong: i.whatsWrong,
        howToFix: i.howToFix.slice(0, FREE_MAX_FIX_STEPS),
        impact: i.impact,
        effort: i.effort,
        affectedCount: shownAffectedCount(i),
        // Worked out on the full report: the trimmed checks below can't reproduce it.
        points,
      })),
    totalIssues: report.issues.length,
    strengths: report.strengths.slice(0, FREE_MAX_STRENGTHS),
    notes: [
      AI_VISIBILITY_NOTE,
      `This free check read ${o.pagesChecked.length} page${o.pagesChecked.length === 1 ? "" : "s"} (your homepage and main pages). The full check can read hundreds of pages.`,
      "Scores show what we found today. They don't predict your Google position or whether AI will name you.",
    ],
  };
}
