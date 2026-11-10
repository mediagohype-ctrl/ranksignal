// Read-only data for the public API and the MCP server (one implementation, two transports). Server-only.
// Every function takes the API key's organizationId and scopes every query by it; a project id from another
// organization is indistinguishable from one that does not exist (404).
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import type { Pillar, IssueImpact, ReportIssue, SiteReport } from "@/lib/report/types";
import { parseVisibility, toSnapshotView, type SnapshotKind, type SnapshotView } from "@/lib/snapshots";
import { groupByQuestion, runProviders, type AnswerObservation } from "@/lib/dashboard/ai-answers";
import { getSearchSummary, type SearchSummary } from "@/lib/google/summary";
import { buildLookerRows, type LookerRow } from "./looker";
import { encodeCursor } from "./params";

export const PILLARS: Pillar[] = ["seo", "aeo", "geo", "brand"];
export const IMPACTS: IssueImpact[] = ["high", "medium", "low"];
const VIS_DONE = ["succeeded", "succeeded_with_warnings"];
const DAY_MS = 86_400_000;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------
// Projects

export interface LatestScores {
  overallScore: number | null;
  grade: string | null;
  pillarScores: Record<Pillar, number | null>;
  openIssues: number | null;
  measuredAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  websiteUrl: string;
  createdAt: string;
  latest: LatestScores | null;
}

export interface ProjectDetail extends ProjectSummary {
  brandNames: string[];
  competitors: { name: string; domain: string | null }[];
  lastWebsiteCheckAt: string | null;
  lastAiCheckAt: string | null;
}

const PROJECT_SELECT = { id: true, name: true, websiteUrl: true, createdAt: true } as const;

function latestOf(v: SnapshotView): LatestScores {
  return {
    overallScore: v.overallScore,
    grade: v.grade,
    pillarScores: v.pillarScores,
    openIssues: v.openIssues?.total ?? null,
    measuredAt: v.createdAt.toISOString(),
  };
}

async function latestSnapshots(organizationId: string, projectIds: string[]): Promise<Map<string, LatestScores>> {
  if (!projectIds.length) return new Map();
  const rows = await db.reportSnapshot.findMany({
    omit: { report: true },
    where: { organizationId, projectId: { in: projectIds }, simulated: false },
    orderBy: [{ projectId: "asc" }, { createdAt: "desc" }],
    distinct: ["projectId"],
  });
  return new Map(rows.map((r) => [r.projectId, latestOf(toSnapshotView(r))]));
}

/** Newest projects first; keyset pagination on (createdAt, id). */
export async function listProjects(organizationId: string, o: { cursor: { t: Date; i: string } | null; limit: number }): Promise<Page<ProjectSummary>> {
  const rows = await db.project.findMany({
    where: {
      organizationId,
      ...(o.cursor ? { OR: [{ createdAt: { lt: o.cursor.t } }, { createdAt: o.cursor.t, id: { lt: o.cursor.i } }] } : {}),
    },
    select: PROJECT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: o.limit + 1,
  });
  const page = rows.slice(0, o.limit);
  const latest = await latestSnapshots(organizationId, page.map((p) => p.id));
  const last = page[page.length - 1];
  return {
    items: page.map((p) => ({ id: p.id, name: p.name, websiteUrl: p.websiteUrl, createdAt: p.createdAt.toISOString(), latest: latest.get(p.id) ?? null })),
    nextCursor: rows.length > o.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), i: last.id }) : null,
  };
}

/** The project if it belongs to this organization, else 404. */
export async function requireApiProject(organizationId: string, projectId: string) {
  if (!projectId || projectId.length > 64) throw new HttpError(404, "not_found", "Project not found");
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
    select: { ...PROJECT_SELECT, brandNames: true, competitors: true },
  });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  return project;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

function competitorsOf(v: unknown): { name: string; domain: string | null }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c) => {
    if (typeof c === "string" && c.trim()) return [{ name: c.trim(), domain: null }];
    if (c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string") {
      const d = (c as { domain?: unknown }).domain;
      return [{ name: (c as { name: string }).name, domain: typeof d === "string" && d ? d : null }];
    }
    return [];
  });
}

export async function getProject(organizationId: string, projectId: string): Promise<ProjectDetail> {
  const p = await requireApiProject(organizationId, projectId);
  const [latest, crawl, vis] = await Promise.all([
    latestSnapshots(organizationId, [p.id]),
    db.crawlRun.findFirst({ where: { organizationId, projectId: p.id, status: "succeeded" }, orderBy: { createdAt: "desc" }, select: { finishedAt: true, createdAt: true } }),
    db.visibilityRun.findFirst({ where: { organizationId, projectId: p.id, status: { in: VIS_DONE } }, orderBy: { createdAt: "desc" }, select: { finishedAt: true, createdAt: true } }),
  ]);
  return {
    id: p.id,
    name: p.name,
    websiteUrl: p.websiteUrl,
    createdAt: p.createdAt.toISOString(),
    latest: latest.get(p.id) ?? null,
    brandNames: strings(p.brandNames),
    competitors: competitorsOf(p.competitors),
    lastWebsiteCheckAt: (crawl?.finishedAt ?? crawl?.createdAt)?.toISOString() ?? null,
    lastAiCheckAt: (vis?.finishedAt ?? vis?.createdAt)?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Report + issues

/** Latest stored SiteReport (never triggers a paid AI call). 404 report_not_available before the first check. */
export async function getReport(organizationId: string, projectId: string): Promise<SiteReport> {
  const p = await requireApiProject(organizationId, projectId);
  const report = await getStoredReport(p.id, organizationId);
  if (!report) throw new HttpError(404, "report_not_available", "No report yet: run a website check in MyWebRank first.");
  return report;
}

export function filterIssues(issues: ReportIssue[], o: { pillar?: Pillar; impact?: IssueImpact }): ReportIssue[] {
  return issues.filter((i) => (!o.pillar || i.pillar === o.pillar) && (!o.impact || i.impact === o.impact));
}

/** Issues from the latest report (sorted by impact, then effort), offset-paginated. */
export async function listIssues(
  organizationId: string,
  projectId: string,
  o: { pillar?: Pillar; impact?: IssueImpact; offset: number; limit: number },
): Promise<Page<ReportIssue> & { total: number; generatedAt: string }> {
  const report = await getReport(organizationId, projectId);
  const all = filterIssues(report.issues, o);
  const items = all.slice(o.offset, o.offset + o.limit);
  const next = o.offset + items.length;
  return { items, total: all.length, generatedAt: report.generatedAt, nextCursor: next < all.length ? encodeCursor({ o: next }) : null };
}

// ---------------------------------------------------------------------------------------------
// Score history

export interface ScorePoint {
  id: string;
  kind: SnapshotKind;
  measuredAt: string;
  overallScore: number | null;
  grade: string | null;
  pillarScores: Record<Pillar, number | null>;
  openIssues: SnapshotView["openIssues"];
  aiVisibility: { mentionRate: number; citationRate: number; recommendationRate: number; visibilityIndex: number; answers: number; providers: string[] } | null;
  methodologyVersion: string;
}

function scorePoint(v: SnapshotView): ScorePoint {
  return {
    id: v.id,
    kind: v.kind,
    measuredAt: v.createdAt.toISOString(),
    overallScore: v.overallScore,
    grade: v.grade,
    pillarScores: v.pillarScores,
    openIssues: v.openIssues,
    aiVisibility: v.visibility
      ? {
          mentionRate: v.visibility.mentionRate,
          citationRate: v.visibility.citationRate,
          recommendationRate: v.visibility.recommendationRate,
          visibilityIndex: v.visibility.visibilityIndex,
          answers: v.visibility.collected,
          providers: v.visibility.providers,
        }
      : null,
    methodologyVersion: v.methodologyVersion,
  };
}

/** Real (non-simulated) score snapshots, newest first; keyset pagination on (createdAt, id). */
export async function listScores(
  organizationId: string,
  projectId: string,
  o: { from?: Date; to?: Date; kind?: SnapshotKind; cursor: { t: Date; i: string } | null; limit: number },
): Promise<Page<ScorePoint>> {
  const p = await requireApiProject(organizationId, projectId);
  const rows = await db.reportSnapshot.findMany({
    omit: { report: true },
    where: {
      organizationId,
      projectId: p.id,
      simulated: false,
      ...(o.kind ? { kind: o.kind } : {}),
      AND: [
        ...(o.from || o.to ? [{ createdAt: { ...(o.from ? { gte: o.from } : {}), ...(o.to ? { lt: o.to } : {}) } }] : []),
        ...(o.cursor ? [{ OR: [{ createdAt: { lt: o.cursor.t } }, { createdAt: o.cursor.t, id: { lt: o.cursor.i } }] }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: o.limit + 1,
  });
  const page = rows.slice(0, o.limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => scorePoint(toSnapshotView(r))),
    nextCursor: rows.length > o.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), i: last.id }) : null,
  };
}

// ---------------------------------------------------------------------------------------------
// AI visibility

export interface QuestionResult {
  promptId: string;
  question: string;
  answers: number;
  mentioned: number;
  cited: number;
  recommended: number;
  mentionRate: number;
  recommendedInstead: string[];
  results: {
    provider: string;
    platform: string;
    mentioned: boolean;
    cited: boolean;
    recommended: boolean;
    citations: { url: string; domain: string; owned: boolean }[];
    excerpt: string;
  }[];
}

export interface VisibilityResult {
  measured: boolean;
  run: { id: string; finishedAt: string | null; providers: string[]; answersCollected: number; answersFailed: number } | null;
  /** True when these answers came from the demo provider (not real AI assistants). */
  simulated: boolean;
  summary: { mentionRate: number; citationRate: number; recommendationRate: number; visibilityIndex: number; competitorShare: Record<string, number>; answers: number } | null;
  questions: QuestionResult[];
}

/** Hard cap on answers read for one response (a large agency check is ~500). */
export const MAX_OBSERVATIONS = 2_000;
const EXCERPT_CHARS = 400;

function excerpt(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > EXCERPT_CHARS ? `${t.slice(0, EXCERPT_CHARS - 1)}…` : t;
}

export function toQuestionResults(observations: AnswerObservation[], ownNames: string[] = []): QuestionResult[] {
  return groupByQuestion(observations, ownNames).map((q) => {
    const cited = q.answers.filter((a) => a.brandCited).length;
    const recommended = q.answers.filter((a) => a.brandRecommended).length;
    return {
      promptId: q.promptId,
      question: q.text,
      answers: q.answers.length,
      mentioned: q.namedCount,
      cited,
      recommended,
      mentionRate: q.answers.length ? Math.round((q.namedCount / q.answers.length) * 10_000) / 10_000 : 0,
      recommendedInstead: q.recommendedInstead,
      results: q.answers.map((a) => ({
        provider: a.provider,
        platform: a.platformLabel,
        mentioned: a.brandMentioned,
        cited: a.brandCited,
        recommended: a.brandRecommended,
        citations: (a.citations ?? []).slice(0, 10).map((c) => ({ url: c.url, domain: c.domain, owned: !!c.ownedByCustomer })),
        excerpt: excerpt(a.rawResponse ?? ""),
      })),
    };
  });
}

const countMap = (v: unknown): Record<string, number> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number"))
    : {};

function citationList(v: unknown): AnswerObservation["citations"] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c) =>
    c && typeof c === "object" && typeof (c as { url?: unknown }).url === "string"
      ? [{ url: (c as { url: string }).url, domain: String((c as { domain?: unknown }).domain ?? ""), ownedByCustomer: (c as { ownedByCustomer?: unknown }).ownedByCustomer === true }]
      : [],
  );
}

/** Latest finished AI check: summary rates + per-question results. measured=false before the first check. */
export async function getVisibility(organizationId: string, projectId: string): Promise<VisibilityResult> {
  const p = await requireApiProject(organizationId, projectId);
  const run = await db.visibilityRun.findFirst({
    where: { organizationId, projectId: p.id, status: { in: VIS_DONE } },
    orderBy: [{ finishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, finishedAt: true, providers: true, collected: true, failed: true, metrics: true },
  });
  if (!run) return { measured: false, run: null, simulated: false, summary: null, questions: [] };
  const rows = await db.observation.findMany({
    where: { organizationId, visibilityRunId: run.id },
    select: {
      id: true, promptId: true, provider: true, platformLabel: true, brandMentioned: true, brandCited: true, brandRecommended: true,
      competitorMentions: true, citations: true, rawResponse: true, simulated: true, prompt: { select: { text: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_OBSERVATIONS,
  });
  const observations: AnswerObservation[] = rows.map((r) => ({
    id: r.id,
    promptId: r.promptId,
    prompt: r.prompt.text,
    provider: r.provider,
    platformLabel: r.platformLabel,
    brandMentioned: r.brandMentioned,
    brandCited: r.brandCited,
    brandRecommended: r.brandRecommended,
    competitorMentions: countMap(r.competitorMentions),
    rawResponse: r.rawResponse,
    citations: citationList(r.citations),
    simulated: r.simulated,
  }));
  const v = parseVisibility(run.metrics, runProviders(run.providers));
  const realExists = observations.some((o) => !o.simulated);
  return {
    measured: true,
    run: { id: run.id, finishedAt: run.finishedAt?.toISOString() ?? null, providers: runProviders(run.providers), answersCollected: run.collected, answersFailed: run.failed },
    simulated: observations.length > 0 && !realExists,
    summary: v
      ? { mentionRate: v.mentionRate, citationRate: v.citationRate, recommendationRate: v.recommendationRate, visibilityIndex: v.visibilityIndex, competitorShare: v.competitorShare, answers: v.collected }
      : null,
    questions: toQuestionResults(observations, strings(p.brandNames)),
  };
}

// ---------------------------------------------------------------------------------------------
// Search Console / GA4 + Looker Studio

export async function getSearchPerformance(organizationId: string, projectId: string, from: string, to: string): Promise<SearchSummary> {
  const p = await requireApiProject(organizationId, projectId);
  return getSearchSummary(p.id, organizationId, from, to, { topN: 25 });
}

export async function getLookerRows(organizationId: string, projectId: string, from: string, to: string): Promise<LookerRow[]> {
  const p = await requireApiProject(organizationId, projectId);
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS);
  const [snapRows, gscRows] = await Promise.all([
    // Newest 2,000 real snapshots up to the end of the range (older ones only matter for the carried-forward start).
    db.reportSnapshot.findMany({
      omit: { report: true },
      where: { organizationId, projectId: p.id, simulated: false, createdAt: { lt: end } },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    }),
    db.metricDaily.findMany({
      where: { organizationId, projectId: p.id, source: "gsc", dimension: "total", key: "", date: { gte: from, lte: to } },
      select: { date: true, clicks: true, impressions: true, ctr: true, position: true },
      take: 400,
    }),
  ]);
  return buildLookerRows(snapRows.map(toSnapshotView), gscRows, from, to);
}
