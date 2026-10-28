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
  affectedCount: number;
}

export interface FreeCheckPillar {
  pillar: Pillar;
  label: string;
  score: number | null;
  grade: Grade | null;
  summary: string;
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
  issues: FreeCheckIssue[];
  /** Total number of issues found (the free result shows only the top ones). */
  totalIssues: number;
  strengths: string[];
  notes: string[];
}

export const AI_VISIBILITY_NOTE =
  "AI visibility (does ChatGPT, Gemini or Claude mention you when customers ask?) is measured in the full report.";
