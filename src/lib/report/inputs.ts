// Inputs and helpers shared by the report checks. Everything here is pure (no I/O).
import type { AuditPage, SiteContext } from "@/lib/audit/rules";
import type { AiVisibilitySummary, CheckResult, Pillar } from "@/lib/report/types";

export interface ReportPage extends AuditPage {
  responseBytes?: number | null;
}

export interface ReportFinding {
  code: string;
  severity: string;
  category: string;
  pageUrl: string | null;
  message: string;
  evidence?: unknown;
}

export interface CheckContext {
  websiteUrl: string;
  brandNames: string[];
  competitors: { name: string; domain?: string }[];
  pages: ReportPage[];
  /** Site-level crawl facts; null when unavailable (then checks fall back to audit findings). */
  site: SiteContext | null;
  findings: ReportFinding[];
  /** AI visibility computed from REAL (non-simulated) observations; measured=false otherwise. */
  ai: AiVisibilitySummary;
  now: Date;
}

/** A check plus the evidence the issue writer needs (stripped before it reaches the SiteReport). */
export interface EvaluatedCheck extends CheckResult {
  affectedUrls: string[];
  affectedCount: number;
  evidence?: string;
  facts: Record<string, number | string | boolean | null>;
}

export const MAX_AFFECTED = 20;

export function statusFor(score: number): CheckResult["status"] {
  return score >= 85 ? "pass" : score >= 50 ? "warn" : "fail";
}

export function makeCheck(
  pillar: Pillar,
  id: string,
  label: string,
  weight: number,
  o: {
    score: number;
    detail: string;
    status?: CheckResult["status"];
    affected?: string[];
    affectedCount?: number;
    evidence?: string;
    facts?: EvaluatedCheck["facts"];
  },
): EvaluatedCheck {
  const score = Math.max(0, Math.min(100, Math.round(o.score)));
  const affected = Array.from(new Set(o.affected ?? []));
  return {
    id,
    pillar,
    label,
    weight,
    score,
    status: o.status ?? statusFor(score),
    detail: o.detail,
    affectedUrls: affected.slice(0, MAX_AFFECTED),
    affectedCount: o.affectedCount ?? affected.length,
    evidence: o.evidence,
    facts: o.facts ?? {},
  };
}

export function notMeasured(pillar: Pillar, id: string, label: string, weight: number, detail: string): EvaluatedCheck {
  return { id, pillar, label, weight, score: 0, status: "not_measured", detail, affectedUrls: [], affectedCount: 0, facts: {} };
}

/** 100 when nothing is wrong, falling linearly with the share of affected items. */
export function ratioScore(bad: number, total: number): number {
  if (total <= 0) return 100;
  return 100 * (1 - bad / total);
}

/** Score for reaching a target share (e.g. 40% of pages) — full marks at or above target. */
export function targetScore(share: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, (100 * share) / target);
}

export const urlOf = (p: AuditPage) => p.finalUrl || p.url;
export const isHtml = (p: AuditPage) => !p.contentType || /html/i.test(p.contentType);
export const okPages = (pages: ReportPage[]) => pages.filter((p) => p.statusCode === 200 && p.extracted && isHtml(p));
/** Pages extracted with the v2 extractor (richer signals). */
export const v2Pages = (pages: ReportPage[]) => okPages(pages).filter((p) => (p.extracted!.extractorVersion ?? 1) >= 2);

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const NEEDS_RESCAN = "Run a new scan to measure this (your last scan predates this check).";

export function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function findHome(ctx: CheckContext): ReportPage | null {
  const ok = okPages(ctx.pages);
  const target = ctx.site?.homepageUrl ?? ctx.websiteUrl;
  const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  return (
    ok.find((p) => norm(p.url) === norm(target) || norm(p.finalUrl) === norm(target)) ??
    ok.find((p) => {
      try {
        return new URL(urlOf(p)).pathname === "/";
      } catch {
        return false;
      }
    }) ??
    ok[0] ??
    null
  );
}
