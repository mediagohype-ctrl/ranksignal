// ONE definition of "how many problems" for every customer-facing surface (Home, Full report, Progress, project
// cards, portfolio, notifications, monthly report, emails, public API).
//
//   problems  = the number of problem TYPES = rows in the report's problem list (report.issues). This is the headline.
//   urgent / important / niceToHave = the same rows split by priority (impact high / medium / low).
//   places    = how many spots on the website those problems touch (sum of each problem's affected count). Only ever
//               shown as "across N places" — never as a headline number.
//   pages     = pages read in the website check.
//
// Raw AuditFinding rows (one per page per problem — the old "109 problems to fix") are NOT a customer number.
// Pure (no I/O). The DB-backed loader for lists of websites lives in ./counts-server.ts.
import type { IssueEffort, ReportIssue, SiteReport } from "@/lib/report/types";
import { pointsForIssue } from "@/lib/report/points";

export interface ProblemCounts {
  problems: number;
  urgent: number;
  important: number;
  niceToHave: number;
  /** Spots on the website the problems touch; null when the source (an older history row) didn't record it. */
  places: number | null;
  /** Pages read in the website check; null when unknown. */
  pages: number | null;
}

export const NO_PROBLEMS: ProblemCounts = { problems: 0, urgent: 0, important: 0, niceToHave: 0, places: 0, pages: null };

type CountableIssue = Pick<ReportIssue, "impact"> & Partial<Pick<ReportIssue, "affectedCount">>;

/** A problem with no page list (e.g. "AI rarely recommends you") still counts as one place. */
export function placesOf(issues: Partial<Pick<ReportIssue, "affectedCount">>[]): number {
  return issues.reduce((a, i) => a + Math.max(1, typeof i.affectedCount === "number" ? i.affectedCount : 1), 0);
}

/** Counts from the report's problem list — the source every surface must use. */
export function problemCounts(report: { issues: CountableIssue[]; crawl?: { pagesCrawled?: number | null } | null } | null | undefined): ProblemCounts {
  if (!report) return { ...NO_PROBLEMS };
  const issues = report.issues ?? [];
  const by = (impact: string) => issues.filter((i) => i.impact === impact).length;
  const pages = report.crawl?.pagesCrawled;
  return {
    problems: issues.length,
    urgent: by("high"),
    important: by("medium"),
    niceToHave: by("low"),
    places: placesOf(issues),
    pages: typeof pages === "number" ? pages : null,
  };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * The same counts read back from a history snapshot's `openIssues` JSON (written by issueCounts(report.issues):
 * critical/high → urgent, medium → important, low/info → nice to have). Null when the snapshot has no counts.
 */
export function problemCountsFromSnapshot(openIssues: unknown, pages?: number | null): ProblemCounts | null {
  if (!openIssues || typeof openIssues !== "object" || Array.isArray(openIssues)) return null;
  const o = openIssues as Record<string, unknown>;
  const urgent = (num(o.critical) ?? 0) + (num(o.high) ?? 0);
  const important = num(o.medium) ?? 0;
  const niceToHave = (num(o.low) ?? 0) + (num(o.info) ?? 0);
  return {
    problems: num(o.total) ?? urgent + important + niceToHave,
    urgent,
    important,
    niceToHave,
    places: num(o.places),
    pages: typeof pages === "number" ? pages : null,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "24 problems" / "1 problem". */
export function problemsLabel(c: Pick<ProblemCounts, "problems">): string {
  return plural(c.problems, "problem");
}

/** "6 urgent, 10 important, 8 nice to have" (groups with 0 are left out); "" when there are no problems. */
export function prioritySplit(c: Pick<ProblemCounts, "urgent" | "important" | "niceToHave">): string {
  return [
    c.urgent ? `${c.urgent} urgent` : "",
    c.important ? `${c.important} important` : "",
    c.niceToHave ? `${c.niceToHave} nice to have` : "",
  ].filter(Boolean).join(", ");
}

/** "24 problems: 6 urgent, 10 important, 8 nice to have" — the one sentence used by notifications, emails and Home. */
export function problemsLine(c: ProblemCounts): string {
  if (c.problems === 0) return "No problems to fix";
  const split = prioritySplit(c);
  return split ? `${problemsLabel(c)}: ${split}` : problemsLabel(c);
}

/** "across 109 places" — the only way instance counts are ever shown. "" when unknown or not more than the problems. */
export function placesLine(c: Pick<ProblemCounts, "problems" | "places">): string {
  return c.places !== null && c.places > c.problems ? `across ${plural(c.places, "place")}` : "";
}

// ---------------------------------------------------------------------------------------------------------------
// "Biggest fix": ONE rule for Home and the Full report — most points first; ties go to the one that takes least time.

/** Minutes a fix takes, by effort (the same numbers the To-do list shows). */
export const FIX_MINUTES: Record<IssueEffort, number> = { quick: 15, moderate: 60, involved: 240 };
const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface FixRank {
  points: number;
  minutes: number;
  impact?: string;
  title?: string;
}

/** Comparator: most points first, then least time, then priority, then title (so the order never flickers). */
export function compareBiggestFix(a: FixRank, b: FixRank): number {
  return (
    b.points - a.points ||
    a.minutes - b.minutes ||
    (IMPACT_RANK[a.impact ?? "low"] ?? 2) - (IMPACT_RANK[b.impact ?? "low"] ?? 2) ||
    (a.title ?? "").localeCompare(b.title ?? "")
  );
}

export function sortByBiggestFix<T extends FixRank>(items: T[]): T[] {
  return [...items].sort(compareBiggestFix);
}

/** Problem id of "AI tools can't read your site because it needs JavaScript" (check seo.js_rendering). */
export const PINNED_FIRST_ID = "seo-js_rendering";

type RankableReport = Pick<SiteReport, "overall" | "pillars" | "issues">;

/** The report's problems, biggest fix first, each with its "+N points" and minutes. */
export function rankedFixes(report: RankableReport): (ReportIssue & { points: number; minutes: number })[] {
  const ranked = sortByBiggestFix(report.issues.map((i) => ({ ...i, points: pointsForIssue(report, i), minutes: FIX_MINUTES[i.effort] ?? FIX_MINUTES.moderate })));
  // A JavaScript-only site hides every other page check, so that one problem always comes first.
  const js = ranked.findIndex((i) => i.id === PINNED_FIRST_ID);
  if (js > 0) ranked.unshift(...ranked.splice(js, 1));
  return ranked;
}

/** The single biggest fix, or null when the report has no problems. */
export function biggestFix(report: RankableReport): (ReportIssue & { points: number; minutes: number }) | null {
  return rankedFixes(report)[0] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Change between two checks (notifications: "2 problems fixed, 1 new. Score 49 → 52.")

export interface ProblemChange {
  /** Problem types in the earlier check that are gone now. */
  fixed: number;
  /** Problem types that weren't in the earlier check. */
  added: number;
  scoreBefore: number | null;
  scoreAfter: number | null;
}

/** Compare two problem lists by problem id (the same rows people see), plus the two overall scores. */
export function problemChange(
  before: { issues: Pick<ReportIssue, "id">[]; score?: number | null },
  after: { issues: Pick<ReportIssue, "id">[]; score?: number | null },
): ProblemChange {
  const was = new Set(before.issues.map((i) => i.id));
  const now = new Set(after.issues.map((i) => i.id));
  return {
    fixed: [...was].filter((id) => !now.has(id)).length,
    added: [...now].filter((id) => !was.has(id)).length,
    scoreBefore: typeof before.score === "number" ? before.score : null,
    scoreAfter: typeof after.score === "number" ? after.score : null,
  };
}

/** "2 problems fixed, 1 new. Score 49 → 52." / "Same problems as last time. Score stayed at 49." */
export function changeLine(c: ProblemChange): string {
  const parts = [c.fixed ? `${plural(c.fixed, "problem")} fixed` : "", c.added ? `${c.added} new` : ""].filter(Boolean);
  const problems = parts.length ? `${parts.join(", ")}.` : "Same problems as last time.";
  const score =
    c.scoreBefore === null || c.scoreAfter === null
      ? ""
      : c.scoreBefore === c.scoreAfter
        ? ` Score stayed at ${c.scoreAfter}.`
        : ` Score ${c.scoreBefore} → ${c.scoreAfter}.`;
  return `${problems}${score}`;
}
