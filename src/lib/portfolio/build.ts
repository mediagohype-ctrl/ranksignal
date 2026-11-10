// Portfolio (all websites in one organisation) — pure row building, sorting and filtering. No I/O, so the
// client table can import it. The server loader (./server.ts) fetches everything in a fixed number of batched
// queries and hands the raw rows here.
import { hostOf } from "@/lib/dashboard/format";

export const PORTFOLIO_HREF = "/app/portfolio";

/** Agencies with 2+ websites land on (or are pointed to) the portfolio first. */
export function shouldSuggestPortfolio(projectCount: number): boolean {
  return projectCount >= 2;
}

export type PortfolioPillar = "seo" | "aeo" | "geo" | "brand";
export const PORTFOLIO_PILLARS: PortfolioPillar[] = ["seo", "aeo", "geo", "brand"];
export type MonthlyState = "sent" | "reviewed" | "draft" | "none";
export type RunningState = "website" | "ai" | "both" | null;

/** One ReportSnapshot row as returned by the batched query (JSON columns still raw). */
export interface PortfolioSnapshotRow {
  projectId: string;
  kind: string;
  crawlRunId: string | null;
  overallScore: number | null;
  grade: string | null;
  pillarScores: unknown;
  openIssues: unknown;
  visibility: unknown;
  simulated: boolean;
  createdAt: Date;
}

export interface PortfolioInput {
  projects: { id: string; name: string; websiteUrl: string; createdAt: Date }[];
  /** Newest-first snapshots per project (the loader sends: latest of any kind, latest few crawl ones, latest real AI one). */
  snapshots: PortfolioSnapshotRow[];
  lastCrawlAt: Map<string, Date | null>;
  lastAiCheckAt: Map<string, Date | null>;
  activeCrawls: Set<string>;
  activeAiChecks: Set<string>;
  /** Monthly report status (draft | reviewed | sent) for the last finished month, per project. */
  monthly: Map<string, string>;
}

export interface PortfolioRow {
  id: string;
  name: string;
  host: string;
  websiteUrl: string;
  score: number | null;
  grade: string | null;
  /** Overall score change since the previous website check (null when there is nothing to compare). */
  scoreChange: number | null;
  pillars: Record<PortfolioPillar, number | null>;
  /** Share (0–1) of tracked AI answers that mention the business; null when not measured with real data. */
  mentionRate: number | null;
  /** Open critical + high problems at the last check. */
  urgent: number | null;
  openTotal: number | null;
  /** ISO time of the last finished website check. */
  lastCheckAt: string | null;
  lastAiCheckAt: string | null;
  running: RunningState;
  monthly: MonthlyState;
}

export interface PortfolioSummary {
  sites: number;
  averageScore: number | null;
  needsAttention: number;
  running: number;
  monthlyNotSent: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function pillarsOf(v: unknown): Record<PortfolioPillar, number | null> {
  const o = obj(v) ?? {};
  return { seo: num(o.seo), aeo: num(o.aeo), geo: num(o.geo), brand: num(o.brand) };
}

function urgentOf(v: unknown): { urgent: number; total: number | null } | null {
  const o = obj(v);
  if (!o) return null;
  const urgent = (num(o.critical) ?? 0) + (num(o.high) ?? 0);
  return { urgent, total: num(o.total) };
}

function mentionOf(v: unknown): number | null {
  const o = obj(v);
  if (!o) return null;
  const rate = num(o.mentionRate);
  const sample = num(o.sampleSize) ?? num(o.collected);
  return rate !== null && (sample === null || sample > 0) ? Math.max(0, Math.min(1, rate)) : null;
}

const MONTHLY: Record<string, MonthlyState> = { sent: "sent", reviewed: "reviewed", draft: "draft" };
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function buildPortfolioRows(input: PortfolioInput): PortfolioRow[] {
  const byProject = new Map<string, PortfolioSnapshotRow[]>();
  for (const s of input.snapshots) {
    const list = byProject.get(s.projectId) ?? [];
    list.push(s);
    byProject.set(s.projectId, list);
  }
  for (const list of byProject.values()) list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return input.projects.map((p) => {
    const snaps = byProject.get(p.id) ?? [];
    const latest = snaps[0] ?? null;
    // Previous website check: the newest crawl snapshot from a different crawl than the latest numbers.
    const prev = latest
      ? snaps.find((s) => s !== latest && s.kind === "crawl" && s.crawlRunId !== latest.crawlRunId && s.overallScore !== null)
      : undefined;
    const score = latest?.overallScore ?? null;
    const scoreChange = score !== null && prev?.overallScore != null ? score - prev.overallScore : null;
    // AI mention rate: only from real (non-simulated) measurements.
    const realVis = snaps.find((s) => !s.simulated && mentionOf(s.visibility) !== null);
    const issues = latest ? urgentOf(latest.openIssues) : null;
    const crawling = input.activeCrawls.has(p.id);
    const asking = input.activeAiChecks.has(p.id);
    return {
      id: p.id,
      name: p.name,
      host: hostOf(p.websiteUrl),
      websiteUrl: p.websiteUrl,
      score,
      grade: latest?.grade ?? null,
      scoreChange,
      pillars: latest ? pillarsOf(latest.pillarScores) : { seo: null, aeo: null, geo: null, brand: null },
      mentionRate: realVis ? mentionOf(realVis.visibility) : null,
      urgent: issues?.urgent ?? null,
      openTotal: issues?.total ?? null,
      lastCheckAt: iso(input.lastCrawlAt.get(p.id)),
      lastAiCheckAt: iso(input.lastAiCheckAt.get(p.id)),
      running: crawling && asking ? "both" : crawling ? "website" : asking ? "ai" : null,
      monthly: MONTHLY[input.monthly.get(p.id) ?? ""] ?? "none",
    };
  });
}

export function summarisePortfolio(rows: PortfolioRow[]): PortfolioSummary {
  const scored = rows.filter((r) => r.score !== null);
  return {
    sites: rows.length,
    averageScore: scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : null,
    needsAttention: rows.filter(needsAttention).length,
    running: rows.filter((r) => r.running).length,
    monthlyNotSent: rows.filter((r) => r.monthly !== "sent").length,
  };
}

/** Urgent problems open, or the score fell by 5+ points since the previous check. */
export function needsAttention(r: PortfolioRow): boolean {
  return (r.urgent ?? 0) > 0 || (r.scoreChange ?? 0) <= -5;
}

// ---------------------------------------------------------------------------------------------
// Sorting / filtering (client table)

export type PortfolioSortKey = "name" | "score" | "change" | "mention" | "urgent" | "lastCheck";
export type PortfolioFilter = "all" | "attention" | "running" | "never_checked" | "monthly_pending";

export function filterPortfolio(rows: PortfolioRow[], o: { q?: string; filter?: PortfolioFilter }): PortfolioRow[] {
  const q = (o.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !r.host.toLowerCase().includes(q)) return false;
    switch (o.filter ?? "all") {
      case "attention":
        return needsAttention(r);
      case "running":
        return !!r.running;
      case "never_checked":
        return !r.lastCheckAt;
      case "monthly_pending":
        return r.monthly !== "sent";
      default:
        return true;
    }
  });
}

function sortValue(r: PortfolioRow, key: PortfolioSortKey): number | string | null {
  switch (key) {
    case "name":
      return r.name.toLowerCase();
    case "score":
      return r.score;
    case "change":
      return r.scoreChange;
    case "mention":
      return r.mentionRate;
    case "urgent":
      return r.urgent;
    case "lastCheck":
      return r.lastCheckAt ? Date.parse(r.lastCheckAt) : null;
  }
}

/** Stable sort; rows without a value always go last, whatever the direction. */
export function sortPortfolio(rows: PortfolioRow[], key: PortfolioSortKey, dir: "asc" | "desc"): PortfolioRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i, v: sortValue(r, key) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      const c = typeof a.v === "string" ? a.v.localeCompare(b.v as string) : (a.v as number) - (b.v as number);
      return c !== 0 ? c * sign : a.r.name.localeCompare(b.r.name);
    })
    .map((x) => x.r);
}
