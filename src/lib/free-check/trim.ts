// Pure: SiteReport → FreeCheckResult (what an anonymous visitor sees).
import type { SiteReport } from "@/lib/report/types";
import { pointsForIssue } from "@/lib/report/points";
import { AI_VISIBILITY_NOTE, FREE_PILLAR_NAMES, type FreeCheckResult } from "@/lib/free-check/types";

/** The free result shows the top 3 fixes; the rest are counted and shown blurred. */
export const FREE_MAX_ISSUES = 3;
export const FREE_MAX_FIX_STEPS = 2;
export const FREE_MAX_STRENGTHS = 5;
export const FREE_MAX_CHECKS_PER_PILLAR = 6;

const STATUS_ORDER: Record<string, number> = { fail: 0, warn: 1, pass: 2 };

export function trimReport(report: SiteReport, o: { brand: string | null; pagesChecked: string[] }): FreeCheckResult {
  return {
    url: report.websiteUrl,
    brand: o.brand,
    checkedAt: report.generatedAt,
    pagesChecked: o.pagesChecked,
    overall: { ...report.overall },
    pillars: report.pillars.map((p) => ({
      pillar: p.pillar,
      label: FREE_PILLAR_NAMES[p.pillar] ?? p.label,
      score: p.score,
      grade: p.grade,
      summary:
        p.score === null
          ? p.pillar === "brand" || p.pillar === "geo"
            ? "Shown in the full check — we ask ChatGPT, Gemini and others about you after you sign up."
            : "We couldn't measure this from the pages we read."
          : p.summary,
      checks: p.checks
        .filter((c) => c.status !== "not_measured")
        .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.weight - a.weight)
        .slice(0, FREE_MAX_CHECKS_PER_PILLAR),
    })),
    issues: report.issues.slice(0, FREE_MAX_ISSUES).map((i) => ({
      id: i.id,
      pillar: i.pillar,
      pillarLabel: FREE_PILLAR_NAMES[i.pillar] ?? "Website",
      title: i.title,
      whatsWrong: i.whatsWrong,
      howToFix: i.howToFix.slice(0, FREE_MAX_FIX_STEPS),
      impact: i.impact,
      effort: i.effort,
      affectedCount: i.affectedCount,
      // Worked out on the full report: the trimmed checks below can't reproduce it.
      points: pointsForIssue(report, i),
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
