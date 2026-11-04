// Pure report assembly: checks → pillar scores → issues → headline, template summary, limitations.
import type { CheckResult, PillarScore, SiteReport } from "@/lib/report/types";
import { runAllChecks } from "@/lib/report/checks";
import { buildIssues, quickWins, strengths } from "@/lib/report/issues";
import { AI_PILLARS, gradeFor, METHODOLOGY_VERSION, overallScore, PILLAR_LABELS, PILLAR_ORDER, pillarScore, pillarSummary, scoreLabel } from "@/lib/report/score";
import { v2Pages, okPages, pct, type CheckContext, type EvaluatedCheck } from "@/lib/report/inputs";
import { templateSummary } from "@/lib/report/summary";
import { applyJsSite, jsFilteredFindings, jsSiteCheck, jsSiteDetection, jsSiteIssue } from "@/lib/report/checks/js-site";

export interface ComposeInput {
  projectId: string;
  brand: string;
  websiteUrl: string;
  generatedAt: Date;
  crawl: { crawlRunId: string; pagesCrawled: number; pagesFound: number; finishedAt: Date | null } | null;
  ctx: CheckContext;
  /** Simulated observations dropped because real ones were available. */
  excludedSimulated?: number;
}

const toResult = ({ id, pillar, label, status, score, weight, detail }: EvaluatedCheck): CheckResult => ({ id, pillar, label, status, score, weight, detail });

export function composeReport(input: ComposeInput): SiteReport {
  const { ctx } = input;
  const ai = ctx.ai;

  if (!input.crawl) {
    const pillars: PillarScore[] = PILLAR_ORDER.map((p) => ({ pillar: p, label: PILLAR_LABELS[p], score: null, grade: null, summary: pillarSummary(p, null, []), checks: [] }));
    const report: SiteReport = {
      projectId: input.projectId,
      brand: input.brand,
      websiteUrl: input.websiteUrl,
      generatedAt: input.generatedAt.toISOString(),
      crawl: { crawlRunId: null, pagesCrawled: 0, finishedAt: null },
      overall: { score: null, grade: null, headline: "We haven't checked your website yet. Run a website check to get your score." },
      pillars,
      issues: [],
      quickWins: [],
      strengths: [],
      aiVisibility: ai,
      executiveSummary: "",
      executiveSummarySource: "template",
      limitations: ["No completed website scan yet, so nothing has been scored."],
      methodologyVersion: METHODOLOGY_VERSION,
    };
    if (ai.measured) report.limitations.push(ai.simulated ? "AI answers on file are simulated demo data and are not used for scoring." : "AI answers are in, but the score waits for a website check.");
    report.executiveSummary = templateSummary(report);
    return report;
  }

  // JavaScript-only site: one problem replaces the per-page symptoms it causes (brief 7.1).
  const js = jsSiteDetection(ctx);
  const jsCheck = jsSiteCheck(ctx, js);
  const byPillar = applyJsSite(runAllChecks(ctx), jsCheck);
  const allChecks = PILLAR_ORDER.flatMap((p) => byPillar[p]);
  // Simulated answers never count, so they leave the score just as partial as no answers.
  const aiIn = ai.measured && !ai.simulated;
  const pillars: PillarScore[] = PILLAR_ORDER.map((p) => {
    const checks = byPillar[p].map(toResult);
    const score = pillarScore(checks);
    const partial = !aiIn && score !== null && AI_PILLARS.includes(p);
    return { pillar: p, label: PILLAR_LABELS[p], score, grade: gradeFor(score), summary: pillarSummary(p, score, checks, aiIn), ...(partial ? { partial } : {}), checks };
  });
  const overall = overallScore(Object.fromEntries(pillars.map((p) => [p.pillar, p.score])));
  const issues = buildIssues(allChecks, jsFilteredFindings(ctx.findings, !!jsCheck));
  if (jsCheck) issues.unshift(jsSiteIssue(jsCheck)); // always the top problem
  const top = issues[0];
  const headline =
    overall === null
      ? "We couldn't score your site from the last check — the pages may not have loaded. Try checking your website again."
      : `${overall} / 100 · ${scoreLabel(overall)}. ${top ? `Biggest fix: ${top.title.replace(/\.$/, "")}.` : "No big problems found on the pages we checked."}`;

  const report: SiteReport = {
    projectId: input.projectId,
    brand: input.brand,
    websiteUrl: input.websiteUrl,
    generatedAt: input.generatedAt.toISOString(),
    crawl: { crawlRunId: input.crawl.crawlRunId, pagesCrawled: input.crawl.pagesCrawled, finishedAt: input.crawl.finishedAt?.toISOString() ?? null },
    overall: { score: overall, grade: gradeFor(overall), headline, ...(overall !== null && !aiIn ? { partial: true } : {}) },
    pillars,
    issues,
    quickWins: quickWins(issues),
    strengths: strengths(allChecks),
    aiVisibility: ai,
    executiveSummary: "",
    executiveSummarySource: "template",
    limitations: limitations(input),
    methodologyVersion: METHODOLOGY_VERSION,
  };
  report.executiveSummary = templateSummary(report);
  return report;
}

function limitations(input: ComposeInput): string[] {
  const { ctx, crawl } = input;
  const out: string[] = [];
  const found = Math.max(crawl!.pagesFound, ctx.site?.pagesDiscovered ?? 0, ctx.site?.sitemapUrlCount ?? 0);
  const crawled = crawl!.pagesCrawled;
  if (found > crawled) out.push(`We checked ${crawled} of at least ${found} pages we found (scan limit ${ctx.site?.maxPages ?? crawled}). Key pages were checked first, but results are based on this sample.`);
  else out.push(`We checked ${crawled} page${crawled === 1 ? "" : "s"} — every page we could find.`);
  const failed = ctx.pages.length - okPages(ctx.pages).length;
  if (failed > 0) out.push(`${failed} page${failed === 1 ? "" : "s"} could not be read (errors or non-HTML), so content checks skip them.`);
  if (ctx.pages.length && v2Pages(ctx.pages).length === 0) out.push("Your last scan was made before some newer checks existed; run a new scan to measure them.");
  if (!ctx.site) out.push("Detailed robots.txt / llms.txt / HTTPS data wasn't recorded for this scan; those checks use the audit findings instead.");
  if (jsSiteDetection(ctx).detected) out.push("Your pages arrive empty and fill in with JavaScript, so checks that read page text are left out until that's fixed.");
  else out.push("We read each page's HTML as delivered. Content that only appears after JavaScript runs may be missed.");
  out.push("Page speed is estimated from page size and scripts (a proxy) — use Google PageSpeed Insights for a real speed test.");
  out.push("Readability uses the Flesch reading-ease formula, which is designed for English text.");
  const ai = ctx.ai;
  if (!ai.measured) out.push("AI visibility hasn't been measured yet, so AI mention and recommendation checks are marked “not measured” and excluded from scores.");
  else if (ai.simulated) out.push("The only AI answers on file are simulated demo data. They are shown for illustration and excluded from all scores.");
  else {
    if ((ai.collected ?? ai.sampleSize) < 30) out.push(`AI visibility is based on a small sample (${ai.collected ?? ai.sampleSize} answers), so rates can change noticeably between runs.`);
    out.push(`AI answers vary between runs and users. Rates (e.g. ${pct(ai.mentionRate ?? 0)} mention rate) describe the sampled answers, not every conversation.`);
  }
  if (input.excludedSimulated) out.push(`${input.excludedSimulated} simulated demo answers were excluded; only real AI answers are counted.`);
  out.push("llms.txt is an emerging convention with no proven effect; it carries very little weight in the score.");
  out.push("Scores summarise what we observed. They are not a prediction of rankings or of being included in AI answers.");
  return out;
}
