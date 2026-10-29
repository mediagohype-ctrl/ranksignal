// Builds the monthly impact report for one project + UTC month from stored data, writes it (upsert by
// projectId + period) and, for self-serve organizations, delivers it immediately. Done-for-you clients
// (Organization.serviceTier set) get a draft that staff review in /admin/monthly-reports.
import { Prisma, type MonthlyReport } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { recordUsage } from "@/lib/billing/usage";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";
import { buildSiteReport } from "@/lib/report/build";
import { FORBIDDEN_CLAIMS } from "@/lib/report/summary";
import { compareSnapshots, getSnapshotAt, listSnapshots } from "@/lib/snapshots";
import { listOpenWork, listShippedWork } from "@/lib/tasks";
import { getSearchSummary } from "@/lib/google/summary";
import { listOffsiteForPeriod } from "@/lib/offsite";
import {
  ATTRIBUTION_NOTE, buildHeadline, buildPlan, classifyIssues, competitorShareRows, engineRows, initialStatus, likeForLike,
  normalizeSnapshot, pickStartEnd, promptsWonLost, rates, scoreDeltas, searchSectionFrom, templateMonthlySummary, type RunObs, type Snap,
} from "./compute";
import { deliverMonthlyReport } from "./deliver";
import { PERIOD_TIMEZONE_NOTE, isPeriodClosed, isValidPeriod, periodLabel, periodRange } from "./period";
import { MONTHLY_REPORT_VERSION, type MonthlyReportPayload, type OffsiteSection, type SearchSection, type ShippedLine, type WrongAnswer } from "./types";

const DONE = ["succeeded", "succeeded_with_warnings"];
const MAX_OBS = 3000;

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

async function loadRunObs(organizationId: string, visibilityRunId: string): Promise<RunObs[]> {
  const rows = await db.observation.findMany({
    where: { organizationId, visibilityRunId, simulated: false },
    select: {
      promptId: true, platformLabel: true, brandMentioned: true, brandCited: true, brandRecommended: true, competitorMentions: true,
      prompt: { select: { text: true } },
    },
    take: MAX_OBS,
  });
  return rows.map((o) => ({
    promptId: o.promptId,
    promptText: o.prompt?.text ?? o.promptId,
    engine: o.platformLabel,
    mentioned: o.brandMentioned,
    cited: o.brandCited,
    recommended: o.brandRecommended,
    competitorMentions: (o.competitorMentions as Record<string, number> | null) ?? {},
  }));
}

function wrongAnswersFrom(runs: { metrics: unknown; finishedAt: Date | null; createdAt: Date }[]): WrongAnswer[] {
  const seen = new Set<string>();
  const out: WrongAnswer[] = [];
  for (const r of runs) {
    const bk = (r.metrics as { brandKnowledge?: unknown; simulated?: unknown } | null) ?? null;
    if (!bk || bk.simulated === true || !Array.isArray(bk.brandKnowledge)) continue;
    for (const b of bk.brandKnowledge) {
      if (!b || typeof b !== "object") continue;
      const engine = typeof (b as { provider?: unknown }).provider === "string" ? (b as { provider: string }).provider : "AI assistant";
      if (/simulat/i.test(engine)) continue;
      for (const s of strArr((b as { inaccuracies?: unknown }).inaccuracies)) {
        const key = `${engine}|${s.trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ engine, statement: s.trim().slice(0, 400), detectedAt: (r.finishedAt ?? r.createdAt).toISOString() });
      }
    }
  }
  return out.slice(0, 15);
}

/** Collects every fact for the report (no writes). Exported for tests and previews. */
export async function buildMonthlyPayload(
  projectId: string,
  organizationId: string,
  period: string,
  now: Date = new Date(),
): Promise<MonthlyReportPayload> {
  if (!isValidPeriod(period)) throw new HttpError(400, "invalid_period", "Period must look like YYYY-MM");
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, name: true, websiteUrl: true, brandNames: true, organization: { select: { serviceTier: true } } },
  });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  const range = periodRange(period);
  const brand = strArr(project.brandNames)[0] ?? project.name;
  const notes: string[] = [PERIOD_TIMEZONE_NOTE];
  if (!isPeriodClosed(period, now)) notes.push("This month isn't over yet, so these numbers are a preview and will change.");

  // ---- scores (crawl snapshots) ----
  const [baselineView, crawlViews, visViews] = await Promise.all([
    getSnapshotAt(projectId, organizationId, range.start, "crawl"),
    listSnapshots(projectId, organizationId, { from: range.start, to: new Date(range.end.getTime() - 1), kind: "crawl" }),
    listSnapshots(projectId, organizationId, { from: range.start, to: new Date(range.end.getTime() - 1), kind: "visibility" }),
  ]);
  const viewBySnap = new Map<Snap, (typeof crawlViews)[number]>();
  const snaps: Snap[] = [];
  for (const v of [...(baselineView ? [baselineView] : []), ...crawlViews]) {
    const s = normalizeSnapshot(v);
    if (s) {
      snaps.push(s);
      viewBySnap.set(s, v);
    }
  }
  const picked = pickStartEnd(snaps, range);
  const deltas = scoreDeltas(picked.start, picked.end);
  try {
    // Notes only (methodology / prompt-set changes, baseline caveats). Like-for-like and fixed/new are computed
    // below on UTC month boundaries with simulated answers excluded and engines matched.
    const d = await compareSnapshots(
      projectId, organizationId,
      picked.start ? viewBySnap.get(picked.start) ?? null : null,
      picked.end ? viewBySnap.get(picked.end) ?? null : null,
    );
    for (const n of d.notes) if (!notes.includes(n)) notes.push(n);
  } catch (e) {
    console.error("[monthly-report] compareSnapshots failed:", e instanceof Error ? e.message : e);
  }
  if (!picked.end) notes.push("No website scan finished this month, so the end-of-month score is missing.");
  else if (!picked.start) notes.push("There's no earlier scan to compare with, so score changes start next month.");

  // ---- AI visibility (first and last real runs of the month; previous month's last run as fallback baseline) ----
  const runSelect = { id: true, createdAt: true, finishedAt: true, metrics: true } as const;
  const [periodRuns, prevRun] = await Promise.all([
    db.visibilityRun.findMany({
      where: { organizationId, projectId, status: { in: DONE }, createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: "asc" },
      select: runSelect,
      take: 200,
    }),
    db.visibilityRun.findFirst({
      where: { organizationId, projectId, status: { in: DONE }, createdAt: { lt: range.start } },
      orderBy: { createdAt: "desc" },
      select: runSelect,
    }),
  ]);
  const obsCache = new Map<string, RunObs[]>();
  const obsFor = async (id: string) => {
    if (!obsCache.has(id)) obsCache.set(id, await loadRunObs(organizationId, id));
    return obsCache.get(id)!;
  };
  // Runs made only of simulated answers have no real observations and are skipped.
  const realRuns: typeof periodRuns = [];
  for (const r of periodRuns) if ((await obsFor(r.id)).length) realRuns.push(r);
  if (realRuns.length < periodRuns.length) notes.push("Simulated (demo) AI answers were excluded from this report.");
  const endRun = realRuns.at(-1) ?? null;
  let startRun = realRuns.length > 1 ? realRuns[0]! : null;
  if (!startRun && prevRun && (await obsFor(prevRun.id)).length) {
    startRun = prevRun;
    notes.push("AI visibility is compared with the last check from the previous month (only one check ran this month).");
  }
  const endObs = endRun ? await obsFor(endRun.id) : null;
  const startObs = startRun ? await obsFor(startRun.id) : null;
  const wonLost = startObs && endObs ? promptsWonLost(startObs, endObs, brand) : { won: [], lost: [] };
  const lfl = startObs && endObs ? likeForLike(startObs, endObs) : null;
  if (startObs && endObs && !lfl) notes.push("The questions or AI engines changed between checks, so AI visibility isn't directly comparable.");
  if (lfl && (lfl.start.answers < 20 || lfl.end.answers < 20)) notes.push("AI visibility is based on a small number of answers; small samples move a lot.");
  if (!endRun) notes.push("No AI visibility check with real answers ran this month.");
  const providers = [...new Set([...(startObs ?? []), ...(endObs ?? [])].map((o) => o.engine))].sort();

  // ---- issues ----
  const findings = await db.auditFinding.findMany({
    where: {
      organizationId, projectId, detectedAt: { lt: range.end },
      OR: [{ status: "open" }, { resolvedAt: { gte: range.start } }],
    },
    select: { code: true, severity: true, message: true, status: true, detectedAt: true, resolvedAt: true },
    take: 10000,
  });
  const issues = classifyIssues(findings, range);

  // ---- work shipped + next month ----
  const [shipped, openWork] = await Promise.all([
    listShippedWork(projectId, organizationId, range.start, range.end, { clientVisibleOnly: true }),
    listOpenWork(projectId, organizationId, { clientVisibleOnly: true }),
  ]);
  const work: MonthlyReportPayload["work"] = {
    shipped: shipped.slice(0, 100).map(
      (s): ShippedLine => ({
        kind: s.kind, title: s.title, category: s.category, performedBy: s.performedBy, completedAt: s.completedAt.toISOString(),
        ...(s.url ? { url: s.url } : {}),
      }),
    ),
    byPerformer: { agency: 0, client: 0, system: 0 },
  };
  for (const s of shipped) work.byPerformer[s.performedBy] = (work.byPerformer[s.performedBy] ?? 0) + 1;
  let reportIssues: { title: string; impact: string }[] = [];
  try {
    reportIssues = (await buildSiteReport(projectId, organizationId)).issues.map((i) => ({ title: i.title, impact: i.impact }));
  } catch (e) {
    console.error("[monthly-report] site report unavailable:", e instanceof Error ? e.message : e);
  }
  const nextMonth = buildPlan(openWork, reportIssues);

  // ---- Google search (Search Console + GA4): this calendar month vs the previous one ----
  let search: SearchSection | null = null;
  try {
    const DAY = 86_400_000;
    const prevStart = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 1, 1));
    const summary = await getSearchSummary(projectId, organizationId, range.start, new Date(range.end.getTime() - DAY), {
      previous: { from: prevStart, to: new Date(range.start.getTime() - DAY) },
    });
    search = searchSectionFrom(summary);
    const connectedNoData = [summary.gsc, summary.ga4].some((x) => x?.connected && !x.hasData);
    if (connectedNoData && !search) notes.push("Google Search Console or Analytics is connected, but no data was available for this month yet.");
    if (search?.gsc && now.getTime() < range.end.getTime() + 3 * DAY) {
      notes.push("Google Search Console data arrives 2–3 days late, so the last few days of the month may be incomplete.");
    }
  } catch (e) {
    console.error("[monthly-report] search metrics unavailable:", e instanceof Error ? e.message : e);
  }

  // ---- off-site work (listings, profiles, mentions) that went live this month ----
  let offsite: OffsiteSection | null = null;
  try {
    const live = await listOffsiteForPeriod(projectId, organizationId, range.start, range.end);
    if (live.length) {
      offsite = {
        live: live.slice(0, 50).map((i) => ({ name: i.name, type: i.type, ...(i.url ? { url: i.url } : {}) })),
        count: live.length,
      };
    }
  } catch (e) {
    console.error("[monthly-report] off-site work unavailable:", e instanceof Error ? e.message : e);
  }

  const base: Omit<MonthlyReportPayload, "headline" | "attribution"> = {
    version: MONTHLY_REPORT_VERSION,
    period,
    periodLabel: periodLabel(period),
    range: { start: range.start.toISOString(), end: range.end.toISOString(), timezone: "UTC" },
    generatedAt: now.toISOString(),
    project: { id: project.id, name: project.name, brand, domain: hostOf(project.websiteUrl), websiteUrl: project.websiteUrl },
    serviceTier: project.organization.serviceTier ?? null,
    dataSources: {
      crawlSnapshots: crawlViews.length,
      visibilitySnapshots: visViews.length,
      visibilityRuns: realRuns.length,
      providers,
      summarySource: "template",
    },
    scores: {
      start: { at: picked.start?.at.toISOString() ?? null, overall: picked.start?.overall ?? null, grade: picked.start?.grade ?? null },
      end: { at: picked.end?.at.toISOString() ?? null, overall: picked.end?.overall ?? null, grade: picked.end?.grade ?? null },
      overallDelta: deltas.overallDelta,
      pillars: deltas.pillars,
      baselineFromPreviousPeriod: picked.baselineFromPreviousPeriod,
    },
    aiVisibility: {
      measured: !!endObs,
      startRunAt: startRun ? (startRun.finishedAt ?? startRun.createdAt).toISOString() : null,
      endRunAt: endRun ? (endRun.finishedAt ?? endRun.createdAt).toISOString() : null,
      start: startObs ? rates(startObs) : null,
      end: endObs ? rates(endObs) : null,
      likeForLike: lfl,
      engines: engineRows(startObs, endObs),
      competitorShare: endObs || startObs ? competitorShareRows(startObs, endObs, brand) : [],
      promptsWon: wonLost.won.slice(0, 20),
      promptsLost: wonLost.lost.slice(0, 20),
    },
    issues,
    work,
    nextMonth,
    wrongAnswers: wrongAnswersFrom(realRuns),
    search,
    offsite,
    notes,
  };
  return { ...base, headline: buildHeadline(base), attribution: ATTRIBUTION_NOTE };
}

// ---- narrative -------------------------------------------------------------------------------------------------

const summarySchema = z.object({ summary: z.string().min(80).max(1400) });
const sentenceCount = (t: string) => t.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;

/** LLM-written summary from computed facts only; null when unconfigured, failed or off-policy. */
export async function llmMonthlySummary(p: MonthlyReportPayload, organizationId: string): Promise<string | null> {
  if (!isLlmConfigured()) return null;
  const v = p.aiVisibility;
  const facts = {
    brand: p.project.brand,
    month: p.periodLabel,
    overallScore: { start: p.scores.start.overall, end: p.scores.end.overall, change: p.scores.overallDelta },
    pillars: p.scores.pillars.map((x) => ({ area: x.label, start: x.start, end: x.end, change: x.delta })),
    aiVisibility: v.measured
      ? {
          mentionRate: { start: v.start?.mentionRate ?? null, end: v.end?.mentionRate ?? null },
          citationRate: { start: v.start?.citationRate ?? null, end: v.end?.citationRate ?? null },
          answersSampled: v.end?.answers ?? 0,
          questionsNewlyMentioned: v.promptsWon.length,
          questionsNoLongerMentioned: v.promptsLost.length,
        }
      : "not measured this month",
    issuesFixed: p.issues.fixed.total,
    newIssues: p.issues.new.total,
    openCriticalOrHigh: p.issues.openBySeverity.critical + p.issues.openBySeverity.high,
    workShipped: p.work.shipped.slice(0, 8).map((w) => w.title),
    nextMonth: p.nextMonth.slice(0, 3).map((n) => n.title),
    inaccurateAiStatements: p.wrongAnswers.length,
    googleSearch: p.search?.gsc
      ? { clicks: { lastMonth: p.search.gsc.clicks.previous, thisMonth: p.search.gsc.clicks.current }, impressions: { lastMonth: p.search.gsc.impressions.previous, thisMonth: p.search.gsc.impressions.current } }
      : "not connected",
    visitsFromAiAssistants: p.search?.ga4 ? { lastMonth: p.search.ga4.aiSessions.previous, thisMonth: p.search.ga4.aiSessions.current } : "not connected",
  };
  try {
    const res = await generateStructured({
      schema: summarySchema,
      system:
        "You write the opening summary of a monthly progress report for a non-technical small-business owner. " +
        "Write 4 to 6 short, plain sentences using ONLY the facts provided; do not add numbers, causes or claims. " +
        "Report changes as measured side by side with the work done; never say the work caused a change. " +
        "Rates are fractions (0.25 = 25%). Never promise or guarantee rankings, traffic, AI mentions or any outcome. " +
        "Be calm and factual, not salesy. Return JSON {\"summary\": string}.",
      user: JSON.stringify(facts),
      maxTokens: 500,
    });
    const text = res?.data.summary.trim();
    if (!text || FORBIDDEN_CLAIMS.test(text)) return null;
    const n = sentenceCount(text);
    if (n < 3 || n > 7) return null;
    try {
      await recordUsage(organizationId, { provider: "openai", taskType: "llm_analysis", credits: 0, costMicros: res!.costMicros, projectId: p.project.id });
    } catch {
      /* usage accounting must not break the report */
    }
    return text;
  } catch {
    return null;
  }
}

// ---- persistence ---------------------------------------------------------------------------------------------------

export interface GenerateOptions {
  /** Rebuild even if a sent report exists (payload/summary refresh only; never re-sends). */
  force?: boolean;
  /** Keep the result as a draft even for self-serve orgs (staff "Generate now" / "Regenerate" previews). */
  holdForReview?: boolean;
  now?: Date;
}

/**
 * Generate (or regenerate) the report for a project + "YYYY-MM". Upserts by (projectId, period).
 * - Existing sent report and !force → returned unchanged.
 * - Service clients → status "draft" (staff review). Self-serve → delivered right away (status "sent").
 */
export async function generateMonthlyReport(
  projectId: string,
  organizationId: string,
  period: string,
  o: GenerateOptions = {},
): Promise<MonthlyReport> {
  const existing = await db.monthlyReport.findUnique({ where: { projectId_period: { projectId, period } } });
  if (existing && existing.organizationId !== organizationId) throw new HttpError(404, "not_found", "Report not found");
  if (existing?.status === "sent" && !o.force) return existing;

  const payload = await buildMonthlyPayload(projectId, organizationId, period, o.now);
  const llm = await llmMonthlySummary(payload, organizationId);
  payload.dataSources.summarySource = llm ? "llm" : "template";
  const summary = llm ?? templateMonthlySummary(payload);
  const json = payload as unknown as Prisma.InputJsonValue;

  if (existing?.status === "sent") {
    return db.monthlyReport.update({ where: { id: existing.id }, data: { payload: json, summary } });
  }
  const status = initialStatus(payload.serviceTier);
  const row = await db.monthlyReport.upsert({
    where: { projectId_period: { projectId, period } },
    create: { organizationId, projectId, period, status: "draft", payload: json, summary },
    // A regenerated draft goes back to "draft" (a staff review applies to the content it reviewed).
    update: { payload: json, summary, status: "draft", reviewedById: null, reviewedAt: null },
  });
  if (status === "sent" && !o.holdForReview) return deliverMonthlyReport(row.id);
  return row;
}
