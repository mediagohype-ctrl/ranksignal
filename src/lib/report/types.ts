// Contract for the SEO / AEO / GEO site report (engine: src/lib/report/*, UI: report pages).
// Every number here is derived from real crawl data, audit findings and stored AI observations.

export type Pillar = "seo" | "aeo" | "geo" | "brand";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type IssueImpact = "high" | "medium" | "low";
export type IssueEffort = "quick" | "moderate" | "involved";

export interface CheckResult {
  id: string; // stable check id, e.g. "seo.meta_description"
  pillar: Pillar;
  label: string; // short, e.g. "Meta descriptions"
  status: "pass" | "warn" | "fail" | "not_measured";
  score: number; // 0-100 for this check
  weight: number; // relative weight inside its pillar
  detail: string; // one line, plain English, with numbers ("12 of 40 pages have no description")
}

/** A problem explained in plain language, ready for a business owner. */
export interface ReportIssue {
  id: string;
  pillar: Pillar;
  title: string; // "Your pages are missing descriptions"
  whatsWrong: string; // simple-terms explanation of the problem
  whyItMatters: string; // effect on Google / AI answers, no guarantees
  howToFix: string[]; // ordered concrete steps
  impact: IssueImpact;
  effort: IssueEffort;
  affectedUrls: string[]; // up to ~20 examples
  affectedCount: number;
  evidence?: string; // short snippet or measured value
  relatedActionType?: string; // links to Actions center when a fix can be drafted
}

export interface PillarScore {
  pillar: Pillar;
  label: string; // "SEO", "AEO (answer engines)", "GEO (generative AI)", "Brand"
  score: number | null; // 0-100, null when not measurable yet
  grade: Grade | null;
  summary: string; // one plain sentence
  checks: CheckResult[];
}

export interface AiVisibilitySummary {
  measured: boolean;
  simulated: boolean; // true if any observation came from the simulated provider
  providers: string[]; // platform labels actually used
  sampleSize: number;
  mentionRate: number | null;
  citationRate: number | null;
  recommendationRate: number | null;
  visibilityIndex: number | null;
  topCompetitors: { name: string; share: number }[];
  /** Your brand's share of all brand+competitor mentions (0-1); null when not measured. */
  brandShare?: number | null;
  /** Answers successfully collected (denominator of the rates). */
  collected?: number;
  topCitedDomains: { domain: string; count: number; owned: boolean }[];
  promptsWhereMissing: { prompt: string; competitorsMentioned: string[] }[]; // up to 10
  brandKnowledge?: { provider: string; knowsBrand: boolean; summary: string; inaccuracies: string[] }[];
  measuredAt: string | null;
}

export interface SiteReport {
  projectId: string;
  brand: string;
  websiteUrl: string;
  generatedAt: string;
  crawl: { crawlRunId: string | null; pagesCrawled: number; finishedAt: string | null };
  overall: { score: number | null; grade: Grade | null; headline: string };
  pillars: PillarScore[]; // always in order seo, aeo, geo, brand
  issues: ReportIssue[]; // sorted: impact desc, then effort asc
  quickWins: string[]; // ids of issues with high/medium impact + quick effort (max 5)
  strengths: string[]; // plain-English things already done well
  aiVisibility: AiVisibilitySummary;
  executiveSummary: string; // 3-5 plain sentences; LLM-written when configured, template otherwise
  executiveSummarySource: "llm" | "template";
  limitations: string[]; // honest caveats (sample size, simulated data, pages not crawled...)
  methodologyVersion: string;
}
