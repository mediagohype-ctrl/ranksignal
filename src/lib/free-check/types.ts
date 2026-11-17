// Public free AI-readiness check (lead magnet): trimmed, anonymous version of the SiteReport.
// No database writes, no LLM calls, no AI visibility measurement.
import type { CheckResult, Grade, IssueEffort, IssueImpact, Pillar } from "@/lib/report/types";

export interface FreeCheckIssue {
  id: string;
  pillar: Pillar;
  pillarLabel: string;
  title: string;
  whatsWrong: string;
  /** First steps only — the full report has the complete fix. */
  howToFix: string[];
  impact: IssueImpact;
  effort: IssueEffort;
  /** Pages affected. When the title names a page count ("…missing on 4 pages"), this is that same number. */
  affectedCount: number;
  /** "+N points": how much the overall score would rise if this were fixed (estimate, same rule as the full report). */
  points?: number;
}

export interface FreeCheckPillar {
  pillar: Pillar;
  label: string;
  score: number | null;
  grade: Grade | null;
  summary: string;
  /**
   * Measured checks in this area: how many pass, how many there are, how many fail. The result UI builds the
   * "0 of 7 pass. 3 matter most." line from these (in English and Hindi); `checks` below is cut to the first few.
   */
  counts: { pass: number; total: number; fail: number };
  /** Measured checks only (fails/warns first). */
  checks: CheckResult[];
}

export interface FreeCheckResult {
  /** Final homepage URL after redirects. */
  url: string;
  /** Brand name we detected (business markup / site name), null when none was found. */
  brand: string | null;
  checkedAt: string;
  pagesChecked: string[];
  overall: { score: number | null; grade: Grade | null; headline: string };
  pillars: FreeCheckPillar[];
  /** Top fixes, biggest "+N points" first. */
  issues: FreeCheckIssue[];
  /** Total number of issues found (the free result shows only the top ones). */
  totalIssues: number;
  /** Lead row for this check (admin CRM), so the visitor can add their email. Null when it could not be stored. */
  leadId?: string | null;
  strengths: string[];
  notes: string[];
}

export const AI_VISIBILITY_NOTE = "This free check reads your website. It does not ask ChatGPT — the full check does.";

/** Plain names for the four scores (docs/PLAIN_WORDS.md). */
export const FREE_PILLAR_NAMES: Record<Pillar, string> = {
  seo: "SEO · Google Score",
  aeo: "AEO · Answer Score",
  geo: "GEO · AI Score",
  brand: "Brand · Trust Score",
};
