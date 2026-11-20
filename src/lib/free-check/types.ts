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

/** Facts we read from the homepage and site files, shown as pictures (no advice, no fix steps). */
export interface FreeCheckSnapshot {
  /** The homepage as Google would list it. */
  google: { title: string | null; description: string | null; url: string };
  /** AI assistants that can (or cannot) read the homepage, per robots.txt. */
  ai: { name: string; allowed: boolean }[];
  facts: {
    https: boolean;
    robotsTxt: boolean;
    sitemap: boolean;
    sitemapUrls: number;
    llmsTxt: boolean;
    /** Business / page info for Google and AI (schema.org types) on the homepage. */
    schemaTypes: string[];
    h1: boolean;
    homeWords: number;
    images: number;
    imagesWithoutAlt: number;
  };
}

/** "Better than N% of websites checked on MyWebRank". */
export interface FreeCheckBenchmark {
  betterThan: number;
  average: number;
  sample: number;
}

/** A problem shown by title only (its fix is in the full report). */
export interface FreeCheckLockedIssue {
  id: string;
  pillar: Pillar;
  title: string;
  impact: IssueImpact;
  affectedCount: number;
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
  /**
   * The next few problems after the top fixes: title, impact and points only, no fix steps (shown locked, as the
   * reason to start the trial). Optional: a server from before this field existed sends none.
   */
  moreIssues?: FreeCheckLockedIssue[];
  /** Every problem found, counted by impact (urgent / important / nice to have), for the severity bar. */
  issueCounts?: Record<IssueImpact, number>;
  /** Visual facts about the homepage and site (Google preview, AI robots, basics). Optional for older servers. */
  snapshot?: FreeCheckSnapshot;
  /** How this score compares with other free checks. Only sent when there are enough checks to be fair. */
  benchmark?: FreeCheckBenchmark | null;
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
