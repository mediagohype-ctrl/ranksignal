// Pure report assembly: checks → pillar scores → issues → headline, template summary, limitations.
import type { CheckResult, PillarScore, SiteReport } from "@/lib/report/types";
import { runAllChecks } from "@/lib/report/checks";
import { buildIssues, quickWins, strengths } from "@/lib/report/issues";
import { gradeFor, METHODOLOGY_VERSION, overallScore, PILLAR_LABELS, PILLAR_ORDER, pillarScore, pillarSummary } from "@/lib/report/score";
import { v2Pages, okPages, pct, type CheckContext, type EvaluatedCheck } from "@/lib/report/inputs";
import { templateSummary } from "@/lib/report/summary";

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
      overall: { score: null, grade: null, headline: "We haven't scanned your website yet. Run a scan to get your SEO, AEO, GEO and brand report." },
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
    if (ai.measured) report.limitations.push(ai.simulated ? "AI answers on file are simulated demo data and are not used for scoring." : "AI visibility was measured, but scores wait for a website scan.");
    report.executiveSummary = templateSummary(report);
    return report;
  }

  const byPillar = runAllChecks(ctx);
  const allChecks = PILLAR_ORDER.flatMap((p) => byPillar[p]);
  const pillars: PillarScore[] = PILLAR_ORDER.map((p) => {
    const checks = byPillar[p].map(toResult);
    const score = pillarScore(checks);
    return { pillar: p, label: PILLAR_LABELS[p], score, grade: gradeFor(score), summary: pillarSummary(p, score, checks), checks };
  });
  const overall = overallScore(Object.fromEntries(pillars.map((p) => [p.pillar, p.score])));
  const issues = buildIssues(allChecks, ctx.findings);
  const top = issues[0];
  const headline =
    overall === null
      ? "We couldn't score your site from the last scan — the pages may not have loaded. Try running a new scan."
      : `Your website scores ${overall}/100 (${gradeFor(overall)}). ${top ? `Biggest opportunity: ${top.title.replace(/\.$/, "")}.` : "No significant problems found in the pages we checked."}`;

  const report: SiteReport = {
    projectId: input.projectId,
    brand: input.brand,
    websiteUrl: input.websiteUrl,
    generatedAt: input.generatedAt.toISOString(),
    crawl: { crawlRunId: input.crawl.crawlRunId, pagesCrawled: input.crawl.pagesCrawled, finishedAt: input.crawl.finishedAt?.toISOString() ?? null },
    overall: { score: overall, grade: gradeFor(overall), headline },
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
  out.push("We read each page's HTML as delivered. Content that only appears after JavaScript runs may be missed.");
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
