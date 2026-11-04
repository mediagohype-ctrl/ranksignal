// Agency prospect report (brief §9): an Agency-plan user types a client's website; we run the free-check engine
// (website only, no LLM) and show a branded one-page report to print or save as PDF.
// Limits: 5 per minute and PROSPECT_DAILY_LIMIT per day per organization (in-memory, like the other public limits),
// and each report records the pages read as "crawl_page" credits so it shows in Usage.
import { checkRateLimit } from "@/lib/auth/rate-limit";
import type { FreeCheckIssue, FreeCheckResult } from "@/lib/free-check/types";

export const PROSPECT_DAILY_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProspectLimit = { allowed: true } | { allowed: false; retryAfterSec: number; scope: "minute" | "day" };

export function checkProspectLimit(organizationId: string, now = Date.now()): ProspectLimit {
  const m = checkRateLimit(`prospect:min:${organizationId}`, 5, 60_000, now);
  if (!m.allowed) return { allowed: false, retryAfterSec: m.retryAfterSec, scope: "minute" };
  const d = checkRateLimit(`prospect:day:${organizationId}`, PROSPECT_DAILY_LIMIT, DAY_MS, now);
  if (!d.allowed) return { allowed: false, retryAfterSec: d.retryAfterSec, scope: "day" };
  return { allowed: true };
}

export interface ProspectReport {
  url: string;
  brand: string | null;
  checkedAt: string;
  score: number | null;
  headline: string;
  pagesChecked: number;
  pillars: { label: string; score: number | null }[];
  topFixes: Pick<FreeCheckIssue, "title" | "whatsWrong" | "howToFix" | "impact" | "effort">[];
  /** Plain-words "what AI tools need" items: the Ready-for-AI checks that aren't passing yet. */
  aiNeeds: { label: string; detail: string; ok: boolean }[];
  strengths: string[];
}

/** Shape the free-check result into the one-page prospect report. */
export function toProspectReport(r: FreeCheckResult): ProspectReport {
  const geo = r.pillars.find((p) => p.pillar === "geo");
  const aiChecks = (geo?.checks ?? []).filter((c) => c.status !== "not_measured");
  const failing = aiChecks.filter((c) => c.status !== "pass");
  const passing = aiChecks.filter((c) => c.status === "pass");
  return {
    url: r.url,
    brand: r.brand,
    checkedAt: r.checkedAt,
    score: r.overall.score,
    headline: r.overall.headline,
    pagesChecked: r.pagesChecked.length,
    pillars: r.pillars.map((p) => ({ label: p.label, score: p.score })),
    topFixes: r.issues.slice(0, 3).map((i) => ({ title: i.title, whatsWrong: i.whatsWrong, howToFix: i.howToFix.slice(0, 2), impact: i.impact, effort: i.effort })),
    aiNeeds: [...failing, ...passing].slice(0, 6).map((c) => ({ label: c.label, detail: c.detail, ok: c.status === "pass" })),
    strengths: r.strengths.slice(0, 4),
  };
}
