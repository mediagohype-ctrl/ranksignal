// Core Web Vitals ratings (pure). Thresholds are Google's published ones, measured at the 75th percentile:
//   LCP ≤ 2.5 s good, ≤ 4 s needs improvement, else poor
//   INP ≤ 200 ms good, ≤ 500 ms needs improvement, else poor
//   CLS ≤ 0.1 good, ≤ 0.25 needs improvement, else poor
// Lab-only helpers (Lighthouse): TBT ≤ 200 ms / ≤ 600 ms (stand-in for INP, which a lab test can't measure),
// FCP ≤ 1.8 s / ≤ 3 s.
import type { AuditDepthData, CoreWebVitalsSummary, PageSpeedRow, PageVitals, VitalRating, VitalValue } from "@/lib/pagespeed/types";

export type VitalMetric = "lcp" | "inp" | "cls" | "tbt" | "fcp";
export const VITAL_THRESHOLDS: Record<VitalMetric, readonly [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  tbt: [200, 600],
  fcp: [1800, 3000],
};
export const VITAL_LABELS: Record<VitalMetric, { short: string; plain: string }> = {
  lcp: { short: "LCP", plain: "Main content shows" },
  inp: { short: "INP", plain: "Reacts to taps" },
  cls: { short: "CLS", plain: "Layout stays still" },
  tbt: { short: "TBT", plain: "Page busy (blocked)" },
  fcp: { short: "FCP", plain: "First thing shows" },
};
export const RATING_LABEL: Record<VitalRating, string> = { good: "Good", needs_improvement: "Needs improvement", poor: "Poor" };
const RATING_RANK: Record<VitalRating, number> = { good: 0, needs_improvement: 1, poor: 2 };
/** Per-page score used by the report check. */
export const RATING_SCORE: Record<VitalRating, number> = { good: 100, needs_improvement: 60, poor: 25 };

export function rateVital(metric: VitalMetric, value: number | null | undefined): VitalRating | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const [good, ni] = VITAL_THRESHOLDS[metric];
  return value <= good ? "good" : value <= ni ? "needs_improvement" : "poor";
}

function vital(metric: VitalMetric, value: number | null | undefined): VitalValue | null {
  const rating = rateVital(metric, value);
  return rating ? { value: value as number, rating } : null;
}

export function worstRating(ratings: (VitalRating | null | undefined)[]): VitalRating | null {
  const r = ratings.filter((x): x is VitalRating => !!x);
  if (!r.length) return null;
  return r.reduce((a, b) => (RATING_RANK[b] > RATING_RANK[a] ? b : a));
}

/** "2.4 s", "180 ms", "0.05". */
export function formatVital(metric: VitalMetric, value: number): string {
  if (metric === "cls") return value < 0.01 ? "0" : value.toFixed(2);
  if (metric === "inp" || metric === "tbt" || value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

/**
 * One tested page. Uses real-user (field) data for this URL when Google has it; otherwise the lab test
 * (LCP, CLS and TBT in place of INP). Origin-level field data is site-wide, so it never stands in for a page.
 */
export function pageVitals(row: PageSpeedRow): PageVitals | null {
  if (row.status !== "ok") return null;
  const field = row.fieldScope === "url" && (row.fieldLcpMs !== null || row.fieldCls !== null || row.fieldInpMs !== null);
  const lcp = vital("lcp", field ? row.fieldLcpMs : row.labLcpMs);
  const cls = vital("cls", field ? row.fieldCls : row.labCls);
  const inp = field ? vital("inp", row.fieldInpMs) : null;
  const tbt = vital("tbt", row.labTbtMs);
  const fcp = vital("fcp", field ? (row.fieldFcpMs ?? row.labFcpMs) : row.labFcpMs);
  const overall = worstRating([lcp?.rating, cls?.rating, field ? inp?.rating : tbt?.rating]);
  if (!lcp && !cls && !inp && !tbt && row.performanceScore === null) return null;
  return {
    url: row.url,
    strategy: row.strategy,
    isHome: row.isHome,
    source: field ? "field" : "lab",
    performanceScore: row.performanceScore,
    lcp,
    inp,
    cls,
    tbt,
    fcp,
    overall,
    fetchedAt: row.fetchedAt,
  };
}

/** Summary stored on the report. null when the speed test never ran for this crawl (older crawls). */
export function summarizeVitals(depth: AuditDepthData | null | undefined): CoreWebVitalsSummary | null {
  if (!depth) return null;
  const rows = depth.pageSpeed;
  const done = depth.status === "succeeded" || depth.status === "partial" || depth.status === "failed";
  const measured = rows.map(pageVitals).filter((p): p is PageVitals => !!p);
  const order = (p: PageVitals) => (p.strategy === "mobile" ? 0 : 2) + (p.isHome ? 0 : 1);
  measured.sort((a, b) => order(a) - order(b));
  const mobile = measured.filter((p) => p.strategy === "mobile");
  const failed = rows.filter((r) => r.status === "failed").length;
  const originRow = rows.find((r) => r.status === "ok" && r.fieldScope === "origin" && r.strategy === "mobile");
  const origin = originRow
    ? { lcp: vital("lcp", originRow.fieldLcpMs), inp: vital("inp", originRow.fieldInpMs), cls: vital("cls", originRow.fieldCls) }
    : null;
  const fieldCount = mobile.filter((p) => p.source === "field").length;
  const testedAt = measured.map((p) => p.fetchedAt).filter((d): d is string => !!d).sort().at(-1) ?? null;
  return {
    status: measured.length ? "measured" : done ? "unavailable" : "pending",
    source: mobile.length === 0 ? null : fieldCount === mobile.length ? "field" : fieldCount === 0 ? "lab" : "mixed",
    pages: measured,
    origin: origin && (origin.lcp || origin.inp || origin.cls) ? origin : null,
    testedAt,
    tested: mobile.length,
    passing: mobile.filter((p) => p.overall === "good").length,
    failed,
  };
}
