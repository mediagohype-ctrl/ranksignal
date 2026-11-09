// Printable COMPLETE report ("Download PDF"): everything we know about the site on one long page, nothing
// collapsed or cut to a sample — every score check, every problem with its fix steps and pages, every AI
// question and answer, and a page-by-page list of what we found. Opens the print dialog on load.
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import { log } from "@/lib/log";
import type { CheckResult, IssueEffort, IssueImpact, ReportIssue, SiteReport } from "@/lib/report/types";
import type { Citation, ExtractedPage } from "@/lib/types";
import { requireAppProject } from "@/lib/dashboard/server";
import { fmtDate, hostOf, pct } from "@/lib/dashboard/format";
import { PILLAR_EXPLAINER, PILLAR_SHORT } from "@/components/app/report/pillars";
import { PrintToolbar } from "@/components/app/report/auto-print";
import { Notice } from "@/components/ui";

export const metadata = { title: "Full report (PDF)", robots: { index: false } };
export const dynamic = "force-dynamic";

const DONE = ["succeeded", "succeeded_with_warnings"];
const MAX_PAGES = 2000;
const MAX_ANSWERS = 400;
const ANSWER_CHARS = 2500;

const IMPACT_LABEL: Record<IssueImpact, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };
const EFFORT_LABEL: Record<IssueEffort, string> = { quick: "Quick fix", moderate: "A few hours", involved: "Bigger job" };
const CHECK_LABEL: Record<CheckResult["status"], string> = { pass: "OK", warn: "Needs work", fail: "Problem", not_measured: "Not measured" };
const CHECK_TONE: Record<CheckResult["status"], string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
  not_measured: "text-muted",
};
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

function shortPath(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" && !u.search ? "/ (home page)" : `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function H2({ id, n, children }: { id: string; n: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 mt-12 break-after-avoid border-b-2 border-fg pb-2 text-h2 text-fg">
      <span className="mr-2 text-muted">{n}.</span>
      {children}
    </h2>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">{children}</p>;
}

function IssueBlock({ issue: i, n, quick }: { issue: ReportIssue; n: number; quick: boolean }) {
  const more = i.affectedCount - i.affectedUrls.length;
  return (
    <article id={`issue-${i.id}`} className="break-inside-avoid-page rounded-xl border border-border p-5">
      <p className="text-xs font-semibold text-muted">
        Problem {n} · {PILLAR_SHORT[i.pillar]} · {IMPACT_LABEL[i.impact]} · {EFFORT_LABEL[i.effort]}
        {quick && " · Fix this first"}
        {i.affectedCount > 0 && ` · ${i.affectedCount} ${i.affectedCount === 1 ? "page" : "pages"}`}
      </p>
      <h3 className="mt-1 text-h3 text-fg">{i.title}</h3>
      <div className="mt-3 space-y-3 text-small leading-relaxed text-fg-soft">
        <div>
          <Label>What&apos;s wrong</Label>
          <p className="mt-1">{i.whatsWrong}</p>
        </div>
        <div>
          <Label>Why it matters</Label>
          <p className="mt-1">{i.whyItMatters}</p>
        </div>
        {i.howToFix.length > 0 && (
          <div>
            <Label>How to fix it</Label>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {i.howToFix.map((s, k) => (
                <li key={k}>{s}</li>
              ))}
            </ol>
          </div>
        )}
        {i.evidence && (
          <div>
            <Label>What we saw</Label>
            <p className="mt-1 whitespace-pre-line break-words font-mono text-xs">{i.evidence}</p>
          </div>
        )}
        {i.affectedUrls.length > 0 && (
          <div>
            <Label>Pages affected</Label>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {i.affectedUrls.map((u) => (
                <li key={u} className="break-all">
                  {u}
                </li>
              ))}
            </ul>
            {more > 0 && <p className="mt-1 text-xs text-muted">…and {more} more (see “Page by page” below).</p>}
          </div>
        )}
      </div>
    </article>
  );
}

export default async function PrintReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const orgId = session.organizationId;
  const back = `/app/projects/${project.id}/report`;

  let report: SiteReport | null = null;
  try {
    report = await getStoredReport(project.id, orgId);
  } catch (e) {
    log.error("report_print.report_failed", { projectId: project.id, orgId, err: e });
  }
  if (!report) {
    return (
      <Notice tone="warning" title="There's no finished report to download yet">
        Check your website first; once the check finishes, your full report can be saved as a PDF.
      </Notice>
    );
  }
  const r = report;

  const visRun = await db.visibilityRun.findFirst({
    where: {
      organizationId: orgId,
      projectId: project.id,
      status: { in: DONE },
      ...(r.aiVisibility.measuredAt ? { finishedAt: { lte: new Date(new Date(r.aiVisibility.measuredAt).getTime() + 60_000) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const [pages, findings, answers] = await Promise.all([
    r.crawl.crawlRunId
      ? db.crawlPage.findMany({
          where: { organizationId: orgId, crawlRunId: r.crawl.crawlRunId },
          select: { url: true, finalUrl: true, statusCode: true, error: true, extracted: true },
          orderBy: { url: "asc" },
          take: MAX_PAGES,
        })
      : Promise.resolve([]),
    db.auditFinding.findMany({
      where: { organizationId: orgId, projectId: project.id, status: "open" },
      select: { pageUrl: true, severity: true, message: true },
      take: 10_000,
    }),
    r.aiVisibility.measured && visRun
      ? db.observation.findMany({
          where: { organizationId: orgId, visibilityRunId: visRun.id },
          select: {
            platformLabel: true,
            rawResponse: true,
            brandMentioned: true,
            brandRecommended: true,
            brandCited: true,
            citations: true,
            simulated: true,
            prompt: { select: { text: true } },
          },
          orderBy: [{ promptId: "asc" }, { platformLabel: "asc" }],
          take: MAX_ANSWERS,
        })
      : Promise.resolve([]),
  ]).catch((e) => {
    log.error("report_print.details_failed", { projectId: project.id, orgId, err: e });
    return [[], [], []] as const;
  });

  // Findings by page (site-wide findings have no page).
  const byPage = new Map<string, { severity: string; message: string }[]>();
  const siteWide: { severity: string; message: string }[] = [];
  for (const f of findings) {
    const row = { severity: f.severity, message: f.message };
    if (!f.pageUrl) siteWide.push(row);
    else byPage.set(f.pageUrl, [...(byPage.get(f.pageUrl) ?? []), row]);
  }
  const sev = (a: { severity: string }, b: { severity: string }) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);

  // AI answers grouped by question.
  const questions = new Map<string, typeof answers>();
  for (const a of answers) {
    const q = a.prompt?.text ?? "Question";
    questions.set(q, [...(questions.get(q) ?? []), a] as typeof answers);
  }

  const ai = r.aiVisibility;
  const quick = new Set(r.quickWins);
  const host = hostOf(r.websiteUrl);
  const issuesById = new Map(r.issues.map((i) => [i.id, i]));
  const quickWins = r.quickWins.map((q) => issuesById.get(q)).filter((i): i is ReportIssue => !!i);
  let n = 0;

  return (
    <div className="mx-auto max-w-4xl text-fg print:max-w-none">
      <PrintToolbar backHref={back} />

      {/* Cover */}
      <header className="break-inside-avoid border-b border-border pb-8">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-primary">MyWebRank · Complete website report</p>
        <h1 className="mt-2 text-h1 text-fg">
          {r.brand} — {host}
        </h1>
        <p className="mt-2 text-small text-muted">
          {r.websiteUrl} · Report made {fmtDate(r.generatedAt, true)} · {r.crawl.pagesCrawled}{" "}
          {r.crawl.pagesCrawled === 1 ? "page" : "pages"} checked
          {ai.measured && ` · ${ai.collected ?? ai.sampleSize} AI answers checked`}
        </p>
        <div className="mt-6 flex flex-wrap items-baseline gap-4">
          <p className="text-5xl font-semibold tabular-nums">
            {r.overall.score ?? "—"}
            <span className="text-h3 text-muted"> / 100</span>
          </p>
          <p className="text-h3 text-fg">{r.overall.headline}</p>
        </div>
        <p className="mt-4 whitespace-pre-line text-body leading-relaxed text-fg-soft">{r.executiveSummary}</p>

        <nav aria-label="Contents" className="mt-6">
          <Label>In this report</Label>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-small text-fg-soft">
            <li>Your scores, and every check behind them</li>
            {quickWins.length > 0 && <li>Fix these first</li>}
            <li>Every problem we found, and how to fix it ({r.issues.length})</li>
            <li>How AI assistants see you</li>
            {questions.size > 0 && <li>Every AI question and answer ({answers.length})</li>}
            {pages.length > 0 && <li>Page by page ({pages.length})</li>}
            {r.strengths.length > 0 && <li>What you&apos;re already doing well</li>}
            <li>Limitations and method</li>
          </ol>
        </nav>
      </header>

      {/* 1. Scores + every check */}
      <section>
        <H2 id="scores" n={++n}>
          Your scores, and every check behind them
        </H2>
        <div className="space-y-6">
          {r.pillars.map((p) => (
            <div key={p.pillar} className="break-inside-avoid-page">
              <h3 className="text-h3 text-fg">
                {PILLAR_SHORT[p.pillar]}: {p.score ?? "not measured yet"}
                {p.score !== null && <span className="text-muted"> / 100</span>}
                {p.partial && <span className="ml-2 text-small font-normal text-muted">(website only — AI answers not in yet)</span>}
              </h3>
              <p className="mt-1 text-small text-fg-soft">{p.summary}</p>
              <p className="text-xs text-muted">{PILLAR_EXPLAINER[p.pillar]}</p>
              {p.checks.length > 0 && (
                <table className="mt-3 w-full border-collapse text-left text-small">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="py-1.5 pr-3 font-semibold">Check</th>
                      <th className="py-1.5 pr-3 font-semibold">Result</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Score</th>
                      <th className="py-1.5 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.checks.map((c) => (
                      <tr key={c.id} className="break-inside-avoid border-b border-border align-top">
                        <td className="py-1.5 pr-3 font-medium text-fg">{c.label}</td>
                        <td className={`whitespace-nowrap py-1.5 pr-3 font-semibold ${CHECK_TONE[c.status]}`}>{CHECK_LABEL[c.status]}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{c.status === "not_measured" ? "—" : c.score}</td>
                        <td className="py-1.5 text-fg-soft">{c.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 2. Quick wins */}
      {quickWins.length > 0 && (
        <section>
          <H2 id="first" n={++n}>
            Fix these first
          </H2>
          <p className="mb-3 text-small text-fg-soft">High-value fixes that are quick to do. Full steps for each are in the next section.</p>
          <ol className="list-decimal space-y-1 pl-5 text-body">
            {quickWins.map((i) => (
              <li key={i.id}>
                <strong>{i.title}</strong> — <span className="text-fg-soft">{i.whatsWrong}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 3. Every problem in full */}
      <section>
        <H2 id="problems" n={++n}>
          Every problem we found, and how to fix it
        </H2>
        {r.issues.length === 0 ? (
          <p className="text-body text-fg-soft">We didn&apos;t find any problems. Nice work.</p>
        ) : (
          <div className="space-y-4">
            {r.issues.map((i, k) => (
              <IssueBlock key={i.id} issue={i} n={k + 1} quick={quick.has(i.id)} />
            ))}
          </div>
        )}
      </section>

      {/* 4. AI visibility summary */}
      <section>
        <H2 id="ai" n={++n}>
          How AI assistants see you
        </H2>
        {!ai.measured ? (
          <p className="text-body text-fg-soft">
            AI answers haven&apos;t been checked yet. Run an AI check from your report to add this section.
          </p>
        ) : (
          <div className="space-y-6 text-small">
            <p className="text-fg-soft">
              Based on {ai.collected ?? ai.sampleSize} answers{ai.providers.length > 0 && ` from ${ai.providers.join(", ")}`}
              {ai.measuredAt && `, collected ${fmtDate(ai.measuredAt)}`}.
              {ai.simulated && " Some answers are sample data, not real AI answers."}
            </p>
            <table className="w-full max-w-md border-collapse text-left">
              <tbody>
                {[
                  ["You were named", pct(ai.mentionRate)],
                  ["You were recommended", pct(ai.recommendationRate)],
                  ["Your site was linked", pct(ai.citationRate)],
                  ["Your share of all brands named", pct(ai.brandShare ?? null)],
                  ["AI visibility score", ai.visibilityIndex === null ? "—" : `${Math.round(ai.visibilityIndex)} / 100`],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-border">
                    <td className="py-1.5 pr-4 text-fg-soft">{k}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ai.topCompetitors.length > 0 && (
              <div className="break-inside-avoid">
                <Label>Competitors AI tools name</Label>
                <ul className="mt-1 list-disc pl-5">
                  {ai.topCompetitors.map((c) => (
                    <li key={c.name}>
                      {c.name} — {pct(c.share)} of mentions
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ai.topCitedDomains.length > 0 && (
              <div className="break-inside-avoid">
                <Label>Websites AI tools link to most</Label>
                <ul className="mt-1 list-disc pl-5">
                  {[...ai.topCitedDomains]
                    .sort((a, b) => b.count - a.count)
                    .map((d) => (
                      <li key={d.domain}>
                        {d.domain} — {d.count} {d.count === 1 ? "link" : "links"}
                        {d.owned && " (your site)"}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {ai.promptsWhereMissing.length > 0 && (
              <div className="break-inside-avoid">
                <Label>Questions where you weren&apos;t named</Label>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {ai.promptsWhereMissing.map((m) => (
                    <li key={m.prompt}>
                      “{m.prompt}”
                      {m.competitorsMentioned.length > 0 && <span className="text-fg-soft"> — named instead: {m.competitorsMentioned.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ai.brandKnowledge && ai.brandKnowledge.length > 0 && (
              <div>
                <Label>What AI tools say about your business</Label>
                <div className="mt-2 space-y-3">
                  {ai.brandKnowledge.map((b) => (
                    <div key={b.provider} className="break-inside-avoid rounded-lg border border-border p-3">
                      <p className="font-semibold text-fg">
                        {b.provider} — {b.knowsBrand ? "knows your business" : "doesn't know your business"}
                      </p>
                      <p className="mt-1 text-fg-soft">{b.summary}</p>
                      {b.inaccuracies.length > 0 && (
                        <>
                          <p className="mt-2 font-semibold text-danger">Things it got wrong:</p>
                          <ul className="list-disc pl-5 text-fg-soft">
                            {b.inaccuracies.map((x, k) => (
                              <li key={k}>{x}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Every AI answer */}
      {questions.size > 0 && (
        <section>
          <H2 id="answers" n={++n}>
            Every AI question and answer
          </H2>
          <div className="space-y-6">
            {[...questions].map(([q, list], qi) => (
              <div key={q}>
                <h3 className="break-after-avoid text-h4 text-fg">
                  Q{qi + 1}. “{q}”
                </h3>
                <div className="mt-2 space-y-3">
                  {list.map((a, k) => {
                    const cites = ((a.citations as Citation[] | null) ?? []).filter((c) => c && c.url);
                    const text = a.rawResponse.length > ANSWER_CHARS ? `${a.rawResponse.slice(0, ANSWER_CHARS).trimEnd()}…` : a.rawResponse;
                    return (
                      <div key={k} className="break-inside-avoid-page rounded-lg border border-border p-3 text-small">
                        <p className="text-xs font-semibold text-muted">
                          {a.platformLabel}
                          {a.simulated && " · sample data"} · {a.brandMentioned ? "named you" : "didn't name you"}
                          {a.brandRecommended && " · recommended you"}
                          {a.brandCited && " · linked your site"}
                        </p>
                        <p className="mt-1.5 whitespace-pre-line break-words leading-relaxed text-fg-soft">{text}</p>
                        {cites.length > 0 && (
                          <p className="mt-2 break-all text-xs text-muted">
                            Sources: {cites.map((c) => c.domain || c.url).join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {answers.length >= MAX_ANSWERS && <p className="mt-3 text-xs text-muted">Showing the first {MAX_ANSWERS} answers.</p>}
        </section>
      )}

      {/* 6. Page by page */}
      {pages.length > 0 && (
        <section>
          <H2 id="pages" n={++n}>
            Page by page
          </H2>
          <p className="mb-4 text-small text-fg-soft">Every page we checked, what Google and AI tools see on it, and the problems we found there.</p>
          {siteWide.length > 0 && (
            <div className="mb-4 break-inside-avoid rounded-lg border border-border p-3 text-small">
              <p className="font-semibold text-fg">Whole website</p>
              <ul className="mt-1 list-disc pl-5 text-fg-soft">
                {siteWide.sort(sev).map((f, k) => (
                  <li key={k}>
                    <span className="font-semibold capitalize">{f.severity}:</span> {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-3">
            {pages.map((p) => {
              const x = (p.extracted as ExtractedPage | null) ?? null;
              const list = [...(byPage.get(p.url) ?? []), ...(p.finalUrl && p.finalUrl !== p.url ? (byPage.get(p.finalUrl) ?? []) : [])].sort(sev);
              return (
                <div key={p.url} className="break-inside-avoid rounded-lg border border-border p-3 text-small">
                  <p className="break-all font-semibold text-fg">{shortPath(p.url)}</p>
                  <p className="break-all text-xs text-muted">
                    {p.url}
                    {p.statusCode ? ` · status ${p.statusCode}` : ""}
                    {x ? ` · ${x.wordCount} words` : ""}
                    {x?.schemaTypes?.length ? ` · structured data: ${x.schemaTypes.join(", ")}` : ""}
                  </p>
                  {p.error && <p className="mt-1 text-danger">Couldn&apos;t read this page: {p.error}</p>}
                  {x && (
                    <dl className="mt-1.5 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5 text-fg-soft">
                      <dt className="text-muted">Title</dt>
                      <dd className="break-words">{x.title || <em>missing</em>}</dd>
                      <dt className="text-muted">Description</dt>
                      <dd className="break-words">{x.description || <em>missing</em>}</dd>
                      <dt className="text-muted">Main heading</dt>
                      <dd className="break-words">{x.h1?.length ? x.h1.join(" · ") : <em>missing</em>}</dd>
                    </dl>
                  )}
                  {list.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5">
                      {list.map((f, k) => (
                        <li key={k}>
                          <span className="font-semibold capitalize">{f.severity}:</span> {f.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !p.error && <p className="mt-2 text-success">No problems found on this page.</p>
                  )}
                </div>
              );
            })}
          </div>
          {pages.length >= MAX_PAGES && <p className="mt-3 text-xs text-muted">Showing the first {MAX_PAGES} pages.</p>}
        </section>
      )}

      {/* 7. Strengths */}
      {r.strengths.length > 0 && (
        <section>
          <H2 id="strengths" n={++n}>
            What you&apos;re already doing well
          </H2>
          <ul className="list-disc space-y-1 pl-5 text-body text-fg-soft">
            {r.strengths.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 8. Limitations */}
      <section className="break-inside-avoid">
        <H2 id="limits" n={++n}>
          Limitations and method
        </H2>
        {r.limitations.length > 0 && (
          <ul className="mb-3 list-disc space-y-1 pl-5 text-small text-fg-soft">
            {r.limitations.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Scores are estimates from the pages we could read and a sample of AI answers; they don&apos;t guarantee rankings or AI placements.
          Methodology v{r.methodologyVersion}. Report made {fmtDate(r.generatedAt, true)} by MyWebRank (mywebrank.tech).
        </p>
      </section>
    </div>
  );
}
