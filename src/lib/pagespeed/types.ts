// Contracts for "audit depth": real page speed from Google PageSpeed Insights (PSI) plus post-crawl probes
// (image file sizes, internal links that redirect, canonical targets, noindex pages listed in the sitemap).
// Stored per crawl (AuditDepthRun + PageSpeedResult rows); read by the report engine via CheckContext.depth.

export type PsiStrategy = "mobile" | "desktop";
export type PsiRowStatus = "pending" | "ok" | "failed";
/** Field data scope: "url" = real Chrome users of this page; "origin" = real users across the whole site. */
export type FieldScope = "url" | "origin";

/** One PSI result (times in milliseconds, CLS unitless). */
export interface PageSpeedRow {
  url: string;
  strategy: PsiStrategy;
  status: PsiRowStatus;
  isHome: boolean;
  /** Lighthouse performance score 0-100 (lab). */
  performanceScore: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  labTbtMs: number | null;
  labFcpMs: number | null;
  fieldLcpMs: number | null;
  fieldInpMs: number | null;
  fieldCls: number | null;
  fieldFcpMs: number | null;
  fieldScope: FieldScope | null;
  error: string | null;
  fetchedAt: string | null;
}

export type ProbeKind = "image" | "link" | "canonical";

/** A HEAD/GET check of one URL found during the crawl. */
export interface ProbeResult {
  kind: ProbeKind;
  url: string;
  /** Final status after redirects (null = could not be fetched). */
  status: number | null;
  finalUrl: string | null;
  /** Redirect hops before the final response. */
  hops: number;
  /** Image file size in bytes (images only; null = unknown). */
  bytes: number | null;
  /** True when the size is a lower bound (the download was cut off at our cap). */
  bytesAtLeast?: boolean;
  contentType: string | null;
  error?: string | null;
  /** Pages that use / link to this URL (up to 10). */
  pages: string[];
}

/** Everything the report engine needs from the audit-depth pass for one crawl. */
export interface AuditDepthData {
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  finishedAt: string | null;
  /** True once the URL probes ran (probes may still be empty when there was nothing to probe). */
  probed: boolean;
  probes: ProbeResult[];
  /** Crawled noindex pages that the sitemap lists; null = the sitemap was not compared. */
  sitemapNoindex: string[] | null;
  pageSpeed: PageSpeedRow[];
}

export type VitalRating = "good" | "needs_improvement" | "poor";
export interface VitalValue {
  value: number;
  rating: VitalRating;
}

/** One tested page as shown on the Core Web Vitals card. */
export interface PageVitals {
  url: string;
  strategy: PsiStrategy;
  isHome: boolean;
  /** Where LCP/INP/CLS come from: real Chrome users of this page (field) or Google's one-off test (lab). */
  source: "field" | "lab";
  performanceScore: number | null;
  lcp: VitalValue | null;
  /** Field only (real users); lab tests can't measure INP. */
  inp: VitalValue | null;
  cls: VitalValue | null;
  /** Lab only: Total Blocking Time, the lab stand-in for INP. */
  tbt: VitalValue | null;
  fcp: VitalValue | null;
  /** Worst of the core metrics measured (LCP, INP or TBT, CLS). */
  overall: VitalRating | null;
  fetchedAt: string | null;
}

/** Core Web Vitals block stored on the SiteReport (card on the report and the page-speed problem page). */
export interface CoreWebVitalsSummary {
  status: "measured" | "pending" | "unavailable";
  /** field = every tested page had real-user data; lab = none did; mixed = some did. */
  source: "field" | "lab" | "mixed" | null;
  /** Mobile results first (homepage first), then the homepage on desktop. */
  pages: PageVitals[];
  /** Real-user data across the whole site (CrUX origin), when Google has it. */
  origin: { lcp: VitalValue | null; inp: VitalValue | null; cls: VitalValue | null } | null;
  testedAt: string | null;
  /** Mobile pages tested / passing (overall "good"). */
  tested: number;
  passing: number;
  /** Pages we asked Google to test whose test failed. */
  failed: number;
}
