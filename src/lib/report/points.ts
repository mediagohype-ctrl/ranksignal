// "+N points": how much the overall score would rise if one problem were fixed. Pure (no I/O).
// Check-based problems: re-score the pillar with that check passing (score 100) and recompute the overall score
// with the same functions the report uses. Audit-finding problems don't feed the score directly, so they get a
// small estimate from their priority. These are estimates of the score we show, never a promise of rankings.
import type { IssueImpact, ReportIssue, SiteReport } from "@/lib/report/types";
import { overallScore, pillarScore } from "@/lib/report/score";
import { checkIdOfIssue } from "@/lib/report/page-notes";

/** Fixing one of these also fixes the listed checks (the report shows only one problem for both). */
const ALSO_FIXES: Record<string, string[]> = {
  "geo.entity_clarity": ["brand.organization_schema"],
};

/** Estimate for problems that don't map to a scored check. */
export const FINDING_POINTS: Record<IssueImpact, number> = { high: 3, medium: 2, low: 1 };

type ScoreView = Pick<SiteReport, "overall" | "pillars">;

/** Unrounded overall score with the given checks treated as passing (null if the report has no score). */
function overallWith(report: ScoreView, passing: Set<string>): number | null {
  const scores = Object.fromEntries(
    report.pillars.map((p) => {
      const checks = p.checks.map((c) => (passing.has(c.id) && c.status !== "not_measured" ? { ...c, status: "pass" as const, score: 100 } : c));
      return [p.pillar, pillarScore(checks)];
    }),
  );
  return overallScore(scores);
}

/**
 * Whole points the overall score would gain if this problem were fixed. 0 when the report has no score; at least 1
 * when fixing it moves the score at all (so a small fix still reads "+1 point", not "+0").
 */
export function pointsForIssue(report: ScoreView, issue: Pick<ReportIssue, "id" | "impact">): number {
  if (report.overall.score === null) return 0;
  const checkId = checkIdOfIssue(issue.id);
  const exists = checkId && report.pillars.some((p) => p.checks.some((c) => c.id === checkId));
  if (!checkId || !exists) return FINDING_POINTS[issue.impact];
  const before = overallWith(report, new Set());
  const after = overallWith(report, new Set([checkId, ...(ALSO_FIXES[checkId] ?? [])]));
  if (before === null || after === null) return 0;
  const gain = after - before;
  if (gain > 0) return Math.max(1, Math.round(gain));
  // Rounding inside pillarScore can hide a small gain; fall back to the weighted share of the check.
  const raw = rawGain(report, checkId);
  return raw > 0 ? 1 : 0;
}

/** Unrounded gain: the check's share of its pillar × the pillar's share of the overall score. */
function rawGain(report: ScoreView, checkId: string): number {
  for (const p of report.pillars) {
    const measured = p.checks.filter((c) => c.status !== "not_measured" && c.weight > 0);
    const c = measured.find((x) => x.id === checkId);
    if (!c) continue;
    const w = measured.reduce((a, x) => a + x.weight, 0);
    return w > 0 ? ((100 - c.score) * c.weight) / w : 0;
  }
  return 0;
}

/** Points for every problem in the report, by problem id. */
export function issuePoints(report: ScoreView & Pick<SiteReport, "issues">): Record<string, number> {
  return Object.fromEntries(report.issues.map((i) => [i.id, pointsForIssue(report, i)]));
}

/** "+1 point" / "+4 points". */
export function pointsLabel(n: number): string {
  return `+${n} ${n === 1 ? "point" : "points"}`;
}
