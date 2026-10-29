// Contract for the monthly impact report (stored frozen in MonthlyReport.payload).
// Every number is computed from stored measurements (snapshots, AI answers, findings, shipped work).
// Measured changes are reported side by side with the work done; we never claim one caused the other.

export type MonthlyReportStatus = "draft" | "reviewed" | "sent";
export const MONTHLY_REPORT_VERSION = "monthly-1";

export interface PillarDelta {
  pillar: "seo" | "aeo" | "geo" | "brand";
  label: string;
  start: number | null;
  end: number | null;
  delta: number | null;
}

export interface RateTriple {
  mentionRate: number | null;
  citationRate: number | null;
  recommendationRate: number | null;
}

export interface EngineRow {
  engine: string; // platform label, e.g. "ChatGPT (API: gpt-4o-mini)"
  start: (RateTriple & { answers: number }) | null;
  end: (RateTriple & { answers: number }) | null;
}

export interface CompetitorShareRow {
  name: string;
  isBrand: boolean;
  start: number | null; // 0-1 share of all brand+competitor mentions
  end: number | null;
  delta: number | null;
}

export interface PromptChange {
  promptId: string;
  prompt: string;
  /** Competitors mentioned in the end-of-period answers to this prompt. */
  competitors: string[];
}

export interface IssueLine {
  title: string;
  severity: string;
  count: number; // pages/occurrences
  code: string;
}

export interface ShippedLine {
  kind: "task" | "change";
  title: string;
  category: string;
  performedBy: "agency" | "client" | "system";
  completedAt: string; // ISO
  url?: string;
}

export interface PlanLine {
  title: string;
  source: "task" | "report";
  status?: string; // task status
  category?: string;
  dueAt?: string | null;
  impact?: string; // for report issues
}

export interface WrongAnswer {
  engine: string;
  statement: string;
  detectedAt: string; // ISO
}

/** This month vs last month for one count. `pct` is relative (0.25 = +25%); null when last month was 0. */
export interface CountChange {
  previous: number;
  current: number;
  delta: number;
  pct: number | null;
}

/** First-party Google data (Search Console + GA4) for the month vs the previous calendar month. Real data only. */
export interface SearchSection {
  gsc: {
    siteUrl: string | null;
    clicks: CountChange;
    impressions: CountChange;
    ctr: { previous: number | null; current: number | null };
    /** Average position (lower is better). */
    position: { previous: number | null; current: number | null };
    topQueries: { query: string; clicks: number; previousClicks: number; change: number }[];
    /** Queries that brought clicks this month and none last month. */
    queriesWon: { query: string; clicks: number; impressions: number }[];
    lastDataDate: string | null;
  } | null;
  ga4: {
    propertyName: string | null;
    sessions: CountChange;
    conversions: CountChange;
    aiSessions: CountChange;
    aiBySource: { label: string; sessions: number; previousSessions: number }[];
  } | null;
  note: string;
}

/** Off-site work that went live in the report period (OffsiteItem rows with status "live" and liveAt in range). */
export interface OffsiteSection {
  live: { name: string; type: string; url?: string }[];
  count: number;
}

export interface MonthlyReportPayload {
  version: typeof MONTHLY_REPORT_VERSION;
  period: string; // YYYY-MM (UTC month)
  periodLabel: string; // "October 2026"
  range: { start: string; end: string; timezone: "UTC" }; // ISO, end exclusive
  generatedAt: string;
  project: { id: string; name: string; brand: string; domain: string; websiteUrl: string };
  serviceTier: string | null;
  dataSources: {
    crawlSnapshots: number;
    visibilitySnapshots: number;
    visibilityRuns: number;
    providers: string[]; // AI engines whose answers were used
    summarySource: "llm" | "template";
  };

  headline: { gains: string[]; risks: string[]; nextActions: string[] };

  scores: {
    start: { at: string | null; overall: number | null; grade: string | null };
    end: { at: string | null; overall: number | null; grade: string | null };
    overallDelta: number | null;
    pillars: PillarDelta[];
    baselineFromPreviousPeriod: boolean;
  };

  aiVisibility: {
    measured: boolean;
    startRunAt: string | null;
    endRunAt: string | null;
    /** All answers in each run. */
    start: (RateTriple & { answers: number }) | null;
    end: (RateTriple & { answers: number }) | null;
    /** Same rates restricted to prompts asked in BOTH runs on the same engines (null when not comparable). */
    likeForLike: { prompts: number; start: RateTriple & { answers: number }; end: RateTriple & { answers: number } } | null;
    engines: EngineRow[];
    competitorShare: CompetitorShareRow[];
    promptsWon: PromptChange[];
    promptsLost: PromptChange[];
  };

  issues: {
    fixed: { total: number; top: IssueLine[] };
    new: { total: number; top: IssueLine[] };
    openBySeverity: Record<"critical" | "high" | "medium" | "low" | "info", number> & { total: number };
  };

  work: { shipped: ShippedLine[]; byPerformer: Record<"agency" | "client" | "system", number> };
  nextMonth: PlanLine[];
  wrongAnswers: WrongAnswer[];
  /** Google Search Console / GA4 numbers; absent on reports generated before this section existed or when not connected. */
  search?: SearchSection | null;
  /** Off-site items (listings, profiles, mentions) that went live this month; absent on older reports. */
  offsite?: OffsiteSection | null;
  attribution: string;
  notes: string[];
}

export interface MonthlyReportListItem {
  id: string;
  projectId: string;
  period: string;
  status: MonthlyReportStatus;
  sentAt: string | null;
  createdAt: string;
}
