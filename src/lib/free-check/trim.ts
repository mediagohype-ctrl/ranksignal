// Pure: SiteReport → FreeCheckResult (what an anonymous visitor sees).
import type { SiteReport } from "@/lib/report/types";
import { AI_VISIBILITY_NOTE, type FreeCheckResult } from "@/lib/free-check/types";

export const FREE_MAX_ISSUES = 5;
export const FREE_MAX_FIX_STEPS = 2;
export const FREE_MAX_STRENGTHS = 5;
export const FREE_MAX_CHECKS_PER_PILLAR = 6;

const STATUS_ORDER: Record<string, number> = { fail: 0, warn: 1, pass: 2 };

export function trimReport(report: SiteReport, o: { brand: string | null; pagesChecked: string[] }): FreeCheckResult {
  const labels = Object.fromEntries(report.pillars.map((p) => [p.pillar, p.label]));
  return {
    url: report.websiteUrl,
    brand: o.brand,
    checkedAt: report.generatedAt,
    pagesChecked: o.pagesChecked,
    overall: { ...report.overall },
    pillars: report.pillars.map((p) => ({
      pillar: p.pillar,
      label: p.label,
      score: p.score,
      grade: p.grade,
      summary:
        p.score === null
          ? p.pillar === "brand" || p.pillar === "geo"
            ? "Needs the full report — we measure this with AI answer checks."
            : "We couldn't measure this from the pages we checked."
          : p.summary,
      checks: p.checks
        .filter((c) => c.status !== "not_measured")
        .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.weight - a.weight)
        .slice(0, FREE_MAX_CHECKS_PER_PILLAR),
    })),
    issues: report.issues.slice(0, FREE_MAX_ISSUES).map((i) => ({
      id: i.id,
      pillar: i.pillar,
      pillarLabel: labels[i.pillar] ?? i.pillar.toUpperCase(),
      title: i.title,
      whatsWrong: i.whatsWrong,
      howToFix: i.howToFix.slice(0, FREE_MAX_FIX_STEPS),
      impact: i.impact,
      effort: i.effort,
      affectedCount: i.affectedCount,
    })),
    totalIssues: report.issues.length,
    strengths: report.strengths.slice(0, FREE_MAX_STRENGTHS),
    notes: [
      AI_VISIBILITY_NOTE,
      `This free check reads ${o.pagesChecked.length} page${o.pagesChecked.length === 1 ? "" : "s"} (your homepage and key pages). The full report checks up to hundreds of pages.`,
      "Scores summarise what we observed. They are not a prediction of rankings or of being included in AI answers.",
    ],
  };
}
