// Loads what each alert rule needs after a run finishes and turns it into AlertCandidates (rules.ts does the
// comparing). Every query is scoped by organizationId + projectId. Read-only apart from one robots.txt fetch
// (SSRF-safe safeFetch, 10s timeout, 512 KB cap) when pages disappeared from a website check.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchRobots } from "@/lib/crawler/robots";
import { isRuleOn, readAlertConfig, threshold, type AlertConfig } from "./config";
import {
  clicksDropAlert, consecutiveDown, indexingAlert, isSiteFailure, mentionDropAlert, mentionDropPoints, missingIndexablePages,
  namedByPrompt, newUrgentAlert, newUrgentIssues, newlyNoindex, questionChangeAlert, questionChanges, scoreDrop, scoreDropAlert,
  siteDownAlert, weekOverWeek, type AlertCandidate, type CrawlOutcome, type IssueLite, type PageIndexState,
} from "./rules";

const DONE = ["succeeded", "succeeded_with_warnings"];
const MAX_PAGES = 5000;
const MAX_ROBOTS_CHECK = 500;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function loadAlertConfig(organizationId: string, projectId: string): Promise<AlertConfig> {
  const row = await db.alertSettings.findFirst({ where: { organizationId, projectId }, select: { config: true } });
  return readAlertConfig(row?.config);
}

async function loadProject(organizationId: string, projectId: string) {
  return db.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true, name: true, websiteUrl: true } });
}

// ------------------------------------------------------------------------------------------------ shared: score

async function scoreCandidate(
  organizationId: string,
  project: { id: string; name: string },
  config: AlertConfig,
  run: { kind: "crawl"; crawlRunId: string } | { kind: "visibility"; visibilityRunId: string },
): Promise<AlertCandidate | null> {
  if (!isRuleOn(config, "score_drop")) return null;
  const snaps = await db.reportSnapshot.findMany({
    where: { organizationId, projectId: project.id, simulated: false, overallScore: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { overallScore: true, crawlRunId: true, visibilityRunId: true },
  });
  const [curr, prev] = snaps;
  if (!curr || !prev) return null;
  const isThisRun = run.kind === "crawl" ? curr.crawlRunId === run.crawlRunId : curr.visibilityRunId === run.visibilityRunId;
  if (!isThisRun) return null;
  const drop = scoreDrop(prev.overallScore, curr.overallScore, threshold(config, "score_drop"));
  return drop === null ? null : scoreDropAlert({ projectId: project.id, projectName: project.name, prev: prev.overallScore!, curr: curr.overallScore!, drop, after: run.kind });
}

// ------------------------------------------------------------------------------------------------ crawl

function issuesOf(report: unknown): IssueLite[] {
  if (!isObj(report) || !Array.isArray(report.issues)) return [];
  return report.issues
    .filter(isObj)
    .filter((i) => typeof i.id === "string" && typeof i.title === "string" && typeof i.impact === "string")
    .map((i) => ({ id: i.id as string, title: i.title as string, impact: i.impact as string }));
}

async function pagesOf(organizationId: string, crawlRunId: string): Promise<PageIndexState[]> {
  return db.$queryRaw<PageIndexState[]>(Prisma.sql`
    SELECT "url", "statusCode", "extracted"->>'robotsMeta' AS "robotsMeta"
      FROM "public"."CrawlPage"
     WHERE "crawlRunId" = ${crawlRunId} AND "organizationId" = ${organizationId}
     LIMIT ${MAX_PAGES}`);
}

async function blocksEveryone(organizationId: string, workflowRunId: string | null): Promise<boolean> {
  if (!workflowRunId) return false;
  const wf = await db.workflowRun.findFirst({ where: { id: workflowRunId, organizationId }, select: { output: true } });
  const site = isObj(wf?.output) && isObj(wf.output.site) ? wf.output.site : null;
  return !!site && isObj(site.robots) && site.robots.blocksEveryone === true;
}

async function crawlOutcomes(organizationId: string, projectId: string, n: number): Promise<CrawlOutcome[]> {
  const runs = await db.crawlRun.findMany({
    where: { organizationId, projectId, status: { in: ["succeeded", "failed"] } },
    orderBy: { createdAt: "desc" },
    take: n,
    select: { id: true, status: true, error: true },
  });
  const out: CrawlOutcome[] = [];
  for (const r of runs) {
    if (r.status === "failed") {
      out.push({ down: isSiteFailure(r.error), reason: r.error });
      continue;
    }
    // A finished check where not a single page answered is also "couldn't reach the site".
    const okPages = await db.crawlPage.count({ where: { organizationId, crawlRunId: r.id, statusCode: { gte: 200, lt: 400 } } });
    out.push({ down: okPages === 0 });
  }
  return out;
}

export async function evaluateAfterCrawl(o: { organizationId: string; projectId: string; crawlRunId: string }): Promise<{ config: AlertConfig; project: { id: string; name: string } | null; candidates: AlertCandidate[] }> {
  const config = await loadAlertConfig(o.organizationId, o.projectId);
  const project = await loadProject(o.organizationId, o.projectId);
  const candidates: AlertCandidate[] = [];
  if (!project) return { config, project: null, candidates };

  if (isRuleOn(config, "site_down")) {
    const n = threshold(config, "site_down");
    if (consecutiveDown(await crawlOutcomes(o.organizationId, project.id, n), n)) {
      candidates.push(siteDownAlert({ projectId: project.id, projectName: project.name, checks: n, websiteUrl: project.websiteUrl }));
    }
  }

  const run = await db.crawlRun.findFirst({
    where: { id: o.crawlRunId, organizationId: o.organizationId, projectId: project.id },
    select: { id: true, status: true, createdAt: true, workflowRunId: true },
  });
  if (!run || run.status !== "succeeded") return { config, project, candidates };

  const score = await scoreCandidate(o.organizationId, project, config, { kind: "crawl", crawlRunId: run.id });
  if (score) candidates.push(score);

  if (isRuleOn(config, "new_urgent_problem")) {
    const snaps = await db.reportSnapshot.findMany({
      where: { organizationId: o.organizationId, projectId: project.id, kind: "crawl" },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { crawlRunId: true, report: true },
    });
    const [curr, prev] = snaps;
    if (curr && prev && curr.crawlRunId === run.id) {
      const fresh = newUrgentIssues(issuesOf(prev.report), issuesOf(curr.report));
      if (fresh.length) candidates.push(newUrgentAlert({ projectId: project.id, projectName: project.name, issues: fresh }));
    }
  }

  if (isRuleOn(config, "indexing_blocked")) {
    const prevRun = await db.crawlRun.findFirst({
      where: { organizationId: o.organizationId, projectId: project.id, status: "succeeded", createdAt: { lt: run.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true, workflowRunId: true },
    });
    if (prevRun) {
      const [prevPages, currPages, wasBlockingAll, nowBlockingAll] = await Promise.all([
        pagesOf(o.organizationId, prevRun.id),
        pagesOf(o.organizationId, run.id),
        blocksEveryone(o.organizationId, prevRun.workflowRunId),
        blocksEveryone(o.organizationId, run.workflowRunId),
      ]);
      const noindex = newlyNoindex(prevPages, currPages);
      let robotsBlocked: string[] = [];
      const missing = missingIndexablePages(prevPages, currPages).slice(0, MAX_ROBOTS_CHECK);
      if (missing.length) {
        try {
          const robots = await fetchRobots(new URL(project.websiteUrl).origin);
          robotsBlocked = robots.fetched ? missing.filter((u) => !robots.isAllowed(u)) : [];
        } catch {
          robotsBlocked = [];
        }
      }
      const allBlocked = nowBlockingAll && !wasBlockingAll;
      if (noindex.length || robotsBlocked.length || allBlocked) {
        candidates.push(indexingAlert({ projectId: project.id, projectName: project.name, noindex, robotsBlocked, blocksEveryone: allBlocked }));
      }
    }
  }
  return { config, project, candidates };
}

// ------------------------------------------------------------------------------------------------ visibility

async function namedRows(organizationId: string, visibilityRunId: string) {
  const rows = await db.observation.findMany({
    where: { organizationId, visibilityRunId, simulated: false },
    select: { promptId: true, brandMentioned: true, prompt: { select: { text: true } } },
    take: 5000,
  });
  return namedByPrompt(rows.map((r) => ({ promptId: r.promptId, text: r.prompt?.text ?? "Question", brandMentioned: r.brandMentioned })));
}

export async function evaluateAfterVisibility(o: { organizationId: string; projectId: string; visibilityRunId: string }) {
  const config = await loadAlertConfig(o.organizationId, o.projectId);
  const project = await loadProject(o.organizationId, o.projectId);
  const candidates: AlertCandidate[] = [];
  if (!project) return { config, project: null, candidates };
  const run = await db.visibilityRun.findFirst({
    where: { id: o.visibilityRunId, organizationId: o.organizationId, projectId: project.id },
    select: { id: true, status: true, createdAt: true },
  });
  if (!run || !DONE.includes(run.status)) return { config, project, candidates };

  const score = await scoreCandidate(o.organizationId, project, config, { kind: "visibility", visibilityRunId: run.id });
  if (score) candidates.push(score);

  if (isRuleOn(config, "ai_mention_drop")) {
    const snaps = await db.reportSnapshot.findMany({
      where: { organizationId: o.organizationId, projectId: project.id, kind: "visibility", simulated: false },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { visibilityRunId: true, visibility: true, promptSetVersion: true },
    });
    const [curr, prev] = snaps;
    const rate = (v: unknown) => (isObj(v) && typeof v.mentionRate === "number" ? v.mentionRate : null);
    if (curr && prev && curr.visibilityRunId === run.id) {
      const drop = mentionDropPoints(rate(prev.visibility), rate(curr.visibility), threshold(config, "ai_mention_drop"));
      if (drop !== null) {
        candidates.push(mentionDropAlert({
          projectId: project.id, projectName: project.name, prev: rate(prev.visibility)!, curr: rate(curr.visibility)!, drop,
          questionsChanged: prev.promptSetVersion !== curr.promptSetVersion,
        }));
      }
    }
  }

  if (isRuleOn(config, "ai_question_change")) {
    const prevRun = await db.visibilityRun.findFirst({
      where: { organizationId: o.organizationId, projectId: project.id, status: { in: DONE }, createdAt: { lt: run.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (prevRun) {
      const [prevRows, currRows] = await Promise.all([namedRows(o.organizationId, prevRun.id), namedRows(o.organizationId, run.id)]);
      const { gained, lost } = questionChanges(prevRows, currRows);
      if (gained.length || lost.length) candidates.push(questionChangeAlert({ projectId: project.id, projectName: project.name, gained, lost }));
    }
  }
  return { config, project, candidates };
}

// ------------------------------------------------------------------------------------------------ Search Console

export async function evaluateAfterSearchSync(o: { organizationId: string; projectId: string; now?: Date }) {
  const config = await loadAlertConfig(o.organizationId, o.projectId);
  const project = await loadProject(o.organizationId, o.projectId);
  const candidates: AlertCandidate[] = [];
  if (!project || !isRuleOn(config, "search_clicks_drop")) return { config, project, candidates };
  const since = new Date((o.now ?? new Date()).getTime() - 21 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.metricDaily.findMany({
    where: { organizationId: o.organizationId, projectId: project.id, source: "gsc", dimension: "total", key: "", date: { gte: since } },
    select: { date: true, clicks: true },
    orderBy: { date: "asc" },
  });
  const wow = weekOverWeek(rows.filter((r) => r.clicks !== null).map((r) => ({ date: r.date, clicks: r.clicks! })));
  if (wow && wow.pct <= -threshold(config, "search_clicks_drop") / 100) {
    candidates.push(clicksDropAlert({ projectId: project.id, projectName: project.name, ...wow }));
  }
  return { config, project, candidates };
}
