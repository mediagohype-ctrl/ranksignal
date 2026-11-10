// Competitors page: types, limits and small pure helpers that are safe to use in both server and client code
// (no database, network or server-only imports). Parsers live in ./parse.ts, database + DataForSEO calls in ./service.ts.
import type { PlanId } from "@/lib/types";
import { normaliseDomain } from "@/lib/dataforseo/locations";

// ---------- Limits ----------

/** Domains per traffic check and per side-by-side comparison. */
export const MAX_TRAFFIC_DOMAINS = 5;
export const MAX_COMPARE_DOMAINS = 5;
/** Batch traffic: most domains in one paste, per plan (the endpoint itself allows 1,000). */
export const BATCH_MAX_DOMAINS: Record<PlanId, number> = { trial: 10, starter: 50, growth: 200, agency: 200 };
export const BATCH_ABSOLUTE_MAX = 200;
export function batchMaxDomains(planId: string | null | undefined): number {
  return planId && planId in BATCH_MAX_DOMAINS ? BATCH_MAX_DOMAINS[planId as PlanId] : BATCH_MAX_DOMAINS.trial;
}

/**
 * Allowance units (DataForSEO usage ledger, see src/lib/dataforseo/usage.ts):
 * - competitor_traffic: 1 per domain in a traffic check, 1 per "top keywords and pages" lookup.
 * - keyword_gap: 1 per gap check (two Labs calls, the second recorded with 0 units: keywords you don't rank for at all + keywords where you rank below 20).
 * - domain_compare: 1 per side-by-side comparison (up to 5 domains), 1 per competitor-suggestion lookup,
 *   and batch traffic = 1 per 50 domains, rounded up (1–4 units for up to 200 domains).
 */
export const UNITS = { trafficPerDomain: 1, topKeywords: 1, gap: 1, compare: 1, suggestions: 1 } as const;
export const BATCH_DOMAINS_PER_UNIT = 50;
export function batchUnits(domainCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, domainCount) / BATCH_DOMAINS_PER_UNIT));
}

/** Ranking at or above this position counts as "ranks for it" in the keyword gap. */
export const GAP_TOP = 20;

export const ESTIMATE_NOTE = "Estimates from DataForSEO, based on rankings × typical click rates — not real analytics.";

// ---------- Types ----------

export interface DomainOverview {
  domain: string;
  /** Estimated monthly visits from Google organic results (DataForSEO "etv"). */
  traffic: number | null;
  top3: number | null;
  top10: number | null;
  top100: number | null;
  /** What the same visits would cost as Google Ads, in USD per month (converted to ₹ for display). */
  trafficValueUsd: number | null;
  newKeywords: number | null;
  lostKeywords: number | null;
}

export interface RankedKeyword {
  keyword: string;
  position: number | null;
  volume: number | null;
  /** 0–100, DataForSEO's keyword difficulty. */
  difficulty: number | null;
  traffic: number | null;
  url: string | null;
}

export interface TopPage {
  url: string;
  traffic: number;
  keywords: number;
}

export interface RankedKeywordsResult {
  domain: string;
  totalKeywords: number | null;
  keywords: RankedKeyword[];
  pages: TopPage[];
}

export interface GapKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  competitorPosition: number | null;
  competitorUrl: string | null;
  /** Your position, or null when you don't rank in the top 100 at all. */
  yourPosition: number | null;
}

export interface BatchRow {
  domain: string;
  traffic: number | null;
  keywords: number | null;
  trafficValueUsd: number | null;
}

export interface SuggestedCompetitor {
  domain: string;
  /** Keywords you both rank for. */
  sharedKeywords: number | null;
  avgPosition: number | null;
  traffic: number | null;
}

// ---------- Helpers ----------

/**
 * Split pasted text (new lines, commas, spaces, semicolons) into normalised, de-duplicated domains.
 * Returns the good ones (in order) and up to 20 entries we couldn't read.
 */
export function parseDomainList(input: string | string[]): { domains: string[]; invalid: string[] } {
  const parts = (Array.isArray(input) ? input : [input])
    .flatMap((s) => String(s).split(/[\s,;]+/))
    .map((s) => s.trim())
    .filter(Boolean);
  const domains: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const d = normaliseDomain(p);
    if (!d) {
      if (invalid.length < 20) invalid.push(p.slice(0, 80));
      continue;
    }
    if (seen.has(d)) continue;
    seen.add(d);
    domains.push(d);
  }
  return { domains, invalid };
}

/** USD/month → ₹/month, rounded to the rupee. */
export function usdToInr(usd: number | null | undefined, rate: number): number | null {
  return usd === null || usd === undefined ? null : Math.round(usd * rate);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Spreadsheet formula injection: a cell starting with = + - @ would run as a formula in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV (CRLF line ends) with formula-injection protection. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function batchCsv(rows: BatchRow[], rate: number): string {
  return toCsv(
    ["Domain", "Estimated monthly Google visits", "Keywords ranking (top 100)", "Estimated traffic value (INR per month)"],
    rows.map((r) => [r.domain, r.traffic, r.keywords, usdToInr(r.trafficValueUsd, rate)]),
  );
}

export function gapCsv(rows: GapKeyword[]): string {
  return toCsv(
    ["Keyword", "Monthly searches", "Difficulty (0-100)", "Competitor position", "Your position", "Competitor page"],
    rows.map((r) => [r.keyword, r.volume, r.difficulty, r.competitorPosition, r.yourPosition ?? "not in top 100", r.competitorUrl]),
  );
}
