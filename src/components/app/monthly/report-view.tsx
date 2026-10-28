// Print-ready monthly impact report (server-compatible: no hooks). Used by the client page and the staff preview.
import clsx from "clsx";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CalendarCheck, CheckCircle2, ClipboardList, Info, ListChecks,
  MessageSquareWarning, Scale, Sparkles, TrendingUp, Wrench,
} from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Callout, EmptyState, SeverityBadge, Table, TD, TH, THead, TR } from "@/components/ui";
import type { MonthlyReportPayload, RateTriple } from "@/lib/monthly-report/types";

const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");
const num = (n: number | null | undefined) => (typeof n === "number" ? String(Math.round(n)) : "—");
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  .mr-root { font-size: 10.5pt; }
  .mr-break { break-before: page; page-break-before: always; }
  .mr-avoid { break-inside: avoid; page-break-inside: avoid; }
  .mr-root .shadow-card { box-shadow: none !important; }
  .mr-root a[href^="http"]::after { content: ""; }
}`;

/** Coloured change chip. `kind` controls formatting: points (scores) or percentage points (rates). */
export function DeltaChip({
  value, kind = "points", invert = false, className,
}: { value: number | null | undefined; kind?: "points" | "rate" | "count"; invert?: boolean; className?: string }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return <span className={clsx("text-small text-muted", className)}>—</span>;
  const shown = kind === "rate" ? Math.round(value * 100) : Math.round(value);
  const good = invert ? shown < 0 : shown > 0;
  const bad = invert ? shown > 0 : shown < 0;
  const Icon = shown === 0 ? ArrowRight : shown > 0 ? ArrowUpRight : ArrowDownRight;
  const unit = kind === "rate" ? " pts" : "";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        good ? "bg-success-soft text-success" : bad ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {shown > 0 ? "+" : shown < 0 ? "−" : "±"}
      {Math.abs(shown)}
      {unit}
      <span className="sr-only">{good ? " (better)" : bad ? " (worse)" : " (no change)"}</span>
    </span>
  );
}

function BeforeAfter({
  label, start, end, deltaValue, kind, hint,
}: { label: string; start: string; end: string; deltaValue: number | null; kind: "points" | "rate"; hint?: string }) {
  return (
    <div className="mr-avoid rounded-2xl border border-border bg-surface p-5">
      <div className="text-caption uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xl font-medium tabular-nums text-muted">{start}</span>
        <ArrowRight aria-label="to" className="size-4 self-center text-muted" />
        <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums text-fg">{end}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeltaChip value={deltaValue} kind={kind} />
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

function HeadlineList({ title, items, tone, icon, empty }: { title: string; items: string[]; tone: "success" | "warning" | "primary"; icon: React.ReactNode; empty: string }) {
  const toneCls = { success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", primary: "bg-primary-soft text-primary-soft-fg" }[tone];
  return (
    <div className="mr-avoid rounded-xl bg-surface-2 p-4">
      <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
        <span aria-hidden className={clsx("grid size-6 place-items-center rounded-full [&_svg]:size-3.5", toneCls)}>{icon}</span>
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-small text-fg-soft">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-border-strong" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-small text-muted">{empty}</p>
      )}
    </div>
  );
}

function RateCells({ s, e, k }: { s: RateTriple | null | undefined; e: RateTriple | null | undefined; k: keyof RateTriple }) {
  const a = s?.[k] ?? null;
  const b = e?.[k] ?? null;
  return (
    <>
      <TD numeric>{pct(a)}</TD>
      <TD numeric>{pct(b)}</TD>
      <TD numeric>
        <DeltaChip value={a !== null && b !== null ? b - a : null} kind="rate" />
      </TD>
    </>
  );
}

function ShareBar({ value, brand }: { value: number | null; brand: boolean }) {
  const w = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-score-track" aria-hidden>
      <div className={clsx("h-full rounded-full", brand ? "bg-primary" : "bg-chart-muted")} style={{ width: `${w}%` }} />
    </div>
  );
}

const PERFORMER: Record<string, string> = { agency: "By our team", client: "By you", system: "Automatic" };

export function MonthlyReportView({ payload: p, summary }: { payload: MonthlyReportPayload; summary: string }) {
  const v = p.aiVisibility;
  const cmpStart = v.likeForLike?.start ?? v.start;
  const cmpEnd = v.likeForLike?.end ?? v.end;
  const rangeEnd = new Date(new Date(p.range.end).getTime() - 1).toISOString();
  const open = p.issues.openBySeverity;

  return (
    <div className="mr-root space-y-8">
      <style>{PRINT_CSS}</style>

      {/* ---- page 1: one-page summary ---- */}
      <section aria-labelledby="mr-title" className="space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">Monthly impact report</p>
              <h1 id="mr-title" className="mt-1 text-h2 text-balance text-fg">
                {p.periodLabel} · {p.project.name}
              </h1>
              <p className="mt-1 text-small text-muted">
                {p.project.domain} · {day(p.range.start)} – {day(rangeEnd)} (UTC)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.dataSources.providers.length > 0 && (
                <Badge tone="neutral" icon={<Bot />}>
                  {p.dataSources.providers.length} AI engine{p.dataSources.providers.length === 1 ? "" : "s"}
                </Badge>
              )}
              <Badge tone="primary" icon={<Wrench />}>
                {p.work.shipped.length} shipped
              </Badge>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-body text-fg-soft">{summary}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <HeadlineList title="Gains" tone="success" icon={<TrendingUp />} items={p.headline.gains} empty="No measured gains this month." />
            <HeadlineList title="Risks" tone="warning" icon={<AlertTriangle />} items={p.headline.risks} empty="No new risks spotted." />
            <HeadlineList title="Next actions" tone="primary" icon={<ListChecks />} items={p.headline.nextActions} empty="Plan to be agreed." />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BeforeAfter
            label="Overall score"
            start={num(p.scores.start.overall)}
            end={num(p.scores.end.overall)}
            deltaValue={p.scores.overallDelta}
            kind="points"
            hint="out of 100"
          />
          <BeforeAfter
            label="Mentioned in AI answers"
            start={pct(cmpStart?.mentionRate)}
            end={pct(cmpEnd?.mentionRate)}
            deltaValue={cmpStart?.mentionRate != null && cmpEnd?.mentionRate != null ? cmpEnd.mentionRate - cmpStart.mentionRate : null}
            kind="rate"
            hint={v.likeForLike ? `same ${v.likeForLike.prompts} questions` : undefined}
          />
          <BeforeAfter
            label="Your site cited by AI"
            start={pct(cmpStart?.citationRate)}
            end={pct(cmpEnd?.citationRate)}
            deltaValue={cmpStart?.citationRate != null && cmpEnd?.citationRate != null ? cmpEnd.citationRate - cmpStart.citationRate : null}
            kind="rate"
          />
          <div className="mr-avoid rounded-2xl border border-border bg-surface p-5">
            <div className="text-caption uppercase tracking-[0.06em] text-muted">Website issues</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums text-success">{p.issues.fixed.total}</span>
              <span className="text-small text-muted">fixed</span>
            </div>
            <div className="mt-2 text-small text-muted tabular-nums">
              {p.issues.new.total} new · {open.total} still open
            </div>
          </div>
        </div>
      </section>

      {/* ---- scores ---- */}
      <Card as="section" className="mr-break mr-avoid">
        <CardHeader
          icon={<Scale />}
          title="Scores: start vs end of month"
          description={`Start: ${day(p.scores.start.at)}${p.scores.baselineFromPreviousPeriod ? " (last scan before this month)" : ""} · End: ${day(p.scores.end.at)}`}
        />
        <Table caption="Scores at the start and end of the month">
          <THead>
            <tr>
              <TH>Area</TH>
              <TH align="right">Start</TH>
              <TH align="right">End</TH>
              <TH align="right">Change</TH>
            </tr>
          </THead>
          <tbody>
            <TR>
              <TD className="font-semibold text-fg">Overall</TD>
              <TD numeric>{num(p.scores.start.overall)}</TD>
              <TD numeric className="font-semibold text-fg">{num(p.scores.end.overall)}</TD>
              <TD numeric><DeltaChip value={p.scores.overallDelta} /></TD>
            </TR>
            {p.scores.pillars.map((x) => (
              <TR key={x.pillar}>
                <TD>{x.label}</TD>
                <TD numeric>{num(x.start)}</TD>
                <TD numeric>{num(x.end)}</TD>
                <TD numeric><DeltaChip value={x.delta} /></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ---- AI visibility ---- */}
      <Card as="section" className="mr-break">
        <CardHeader
          icon={<Bot />}
          title="AI visibility"
          description={
            v.measured
              ? `Checks on ${day(v.startRunAt)} and ${day(v.endRunAt)}. ${v.likeForLike ? `Compared on the ${v.likeForLike.prompts} questions asked in both checks (${v.likeForLike.start.answers} → ${v.likeForLike.end.answers} answers).` : `${v.end?.answers ?? 0} answers at the end of the month.`}`
              : "No AI visibility check with real answers ran this month."
          }
        />
        {v.measured ? (
          <CardBody className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-border">
              <Table caption="AI visibility rates, start vs end">
                <THead>
                  <tr>
                    <TH>Measure</TH>
                    <TH align="right">Start</TH>
                    <TH align="right">End</TH>
                    <TH align="right">Change</TH>
                  </tr>
                </THead>
                <tbody>
                  <TR><TD>Mentioned by name</TD><RateCells s={cmpStart} e={cmpEnd} k="mentionRate" /></TR>
                  <TR><TD>Your website cited as a source</TD><RateCells s={cmpStart} e={cmpEnd} k="citationRate" /></TR>
                  <TR><TD>Recommended</TD><RateCells s={cmpStart} e={cmpEnd} k="recommendationRate" /></TR>
                </tbody>
              </Table>
            </div>

            {v.engines.length > 0 && (
              <div className="mr-avoid">
                <h3 className="mb-2 text-h4 text-fg">Engine by engine</h3>
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table caption="AI visibility by engine" density="compact">
                    <THead>
                      <tr>
                        <TH>Engine</TH>
                        <TH align="right">Mentioned</TH>
                        <TH align="right">Cited</TH>
                        <TH align="right">Recommended</TH>
                        <TH align="right">Answers</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {v.engines.map((r) => (
                        <TR key={r.engine}>
                          <TD className="font-medium text-fg">{r.engine}</TD>
                          {(["mentionRate", "citationRate", "recommendationRate"] as const).map((k) => (
                            <TD key={k} numeric>
                              <span className="text-muted">{pct(r.start?.[k])}</span> → <span className="font-semibold text-fg">{pct(r.end?.[k])}</span>{" "}
                              <DeltaChip value={r.start?.[k] != null && r.end?.[k] != null ? r.end[k]! - r.start[k]! : null} kind="rate" className="ml-1" />
                            </TD>
                          ))}
                          <TD numeric>{r.start?.answers ?? 0} → {r.end?.answers ?? 0}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}

            {v.competitorShare.length > 0 && (
              <div className="mr-avoid">
                <h3 className="text-h4 text-fg">Share of AI mentions</h3>
                <p className="mt-1 text-small text-muted">Of all the times AI answers mentioned you or a competitor, how often it was each brand.</p>
                <ul className="mt-4 space-y-3">
                  {v.competitorShare.map((c) => (
                    <li key={c.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-small sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
                      <span className={clsx("truncate", c.isBrand ? "font-semibold text-fg" : "text-fg-soft")}>
                        {c.name}
                        {c.isBrand && <span className="text-muted"> (you)</span>}
                      </span>
                      <div className="space-y-1">
                        <ShareBar value={c.start} brand={false} />
                        <ShareBar value={c.end} brand={c.isBrand} />
                      </div>
                      <span className="whitespace-nowrap tabular-nums text-fg-soft">
                        {pct(c.start)} → <strong className="text-fg">{pct(c.end)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Top bar: start of month. Bottom bar: end of month.</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="mr-avoid rounded-xl bg-surface-2 p-4">
                <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
                  <CheckCircle2 aria-hidden className="size-4 text-success" /> Questions where you&apos;re now mentioned ({v.promptsWon.length})
                </h3>
                {v.promptsWon.length ? (
                  <ul className="mt-3 space-y-2 text-small text-fg-soft">
                    {v.promptsWon.map((x) => <li key={x.promptId}>“{x.prompt}”</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-small text-muted">None this month.</p>
                )}
              </div>
              <div className="mr-avoid rounded-xl bg-surface-2 p-4">
                <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
                  <AlertTriangle aria-hidden className="size-4 text-warning" /> Questions where you&apos;re no longer mentioned ({v.promptsLost.length})
                </h3>
                {v.promptsLost.length ? (
                  <ul className="mt-3 space-y-2 text-small text-fg-soft">
                    {v.promptsLost.map((x) => (
                      <li key={x.promptId}>
                        “{x.prompt}”
                        {x.competitors.length > 0 && <span className="block text-xs text-muted">Mentioned instead: {x.competitors.join(", ")}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-small text-muted">None this month.</p>
                )}
              </div>
            </div>
          </CardBody>
        ) : (
          <CardBody>
            <EmptyState size="sm" icon={<Bot />} title="Not measured this month" description="Once an AI visibility check runs, next month's report will compare AI answers." />
          </CardBody>
        )}
      </Card>

      {/* ---- issues ---- */}
      <Card as="section" className="mr-break mr-avoid">
        <CardHeader icon={<ClipboardList />} title="Website issues" description="From automatic scans of your site." />
        <CardBody className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-success-soft p-4">
              <div className="text-caption uppercase tracking-[0.06em] text-success">Fixed this month</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums text-fg">{p.issues.fixed.total}</div>
            </div>
            <div className="rounded-xl bg-warning-soft p-4">
              <div className="text-caption uppercase tracking-[0.06em] text-warning">New this month</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums text-fg">{p.issues.new.total}</div>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <div className="text-caption uppercase tracking-[0.06em] text-muted">Still open</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums text-fg">{open.total}</div>
              <div className="mt-1 text-xs text-muted tabular-nums">
                {open.critical} critical · {open.high} high · {open.medium} medium · {open.low} low
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([["Fixed", p.issues.fixed.top], ["New", p.issues.new.top]] as const).map(([label, rows]) => (
              <div key={label}>
                <h3 className="text-small font-semibold text-fg">{label}</h3>
                {rows.length ? (
                  <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                    {rows.map((i) => (
                      <li key={i.code} className="flex items-start justify-between gap-3 px-3 py-2 text-small">
                        <span className="text-fg-soft">{i.title}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <SeverityBadge severity={i.severity} />
                          <span className="tabular-nums text-muted">×{i.count}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-small text-muted">None.</p>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ---- work shipped ---- */}
      <Card as="section" className="mr-break">
        <CardHeader icon={<Wrench />} title="Work shipped" description={`${p.work.byPerformer.agency} by our team · ${p.work.byPerformer.client} by you · ${p.work.byPerformer.system} automatic`} />
        <CardBody>
          {p.work.shipped.length ? (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {p.work.shipped.map((w, i) => (
                <li key={i} className="mr-avoid relative">
                  <span aria-hidden className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
                  <div className="text-xs text-muted tabular-nums">{day(w.completedAt)}</div>
                  <div className="text-small font-medium text-fg">
                    {w.url ? (
                      <a href={w.url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                        {w.title}
                      </a>
                    ) : (
                      w.title
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge size="sm" tone="neutral" className="capitalize">{w.category}</Badge>
                    <Badge size="sm" tone={w.performedBy === "agency" ? "primary" : "neutral"}>{PERFORMER[w.performedBy] ?? w.performedBy}</Badge>
                    {w.kind === "change" && <Badge size="sm" tone="accent">Published change</Badge>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState size="sm" icon={<Wrench />} title="Nothing marked as shipped this month" />
          )}
        </CardBody>
      </Card>

      {/* ---- next month ---- */}
      <Card as="section" className="mr-avoid">
        <CardHeader icon={<CalendarCheck />} title="Next month's plan" />
        <CardBody>
          {p.nextMonth.length ? (
            <ul className="divide-y divide-border">
              {p.nextMonth.map((n, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-small">
                  <span className="text-fg">{n.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {n.source === "report" ? (
                      <Badge size="sm" tone="info">From your site report</Badge>
                    ) : (
                      <Badge size="sm" tone="neutral" className="capitalize">{(n.status ?? "planned").replace(/_/g, " ")}</Badge>
                    )}
                    {n.dueAt && <span className="tabular-nums">Due {day(n.dueAt)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted">No open items yet.</p>
          )}
        </CardBody>
      </Card>

      {/* ---- wrong AI answers ---- */}
      {p.wrongAnswers.length > 0 && (
        <Card as="section" className="mr-avoid">
          <CardHeader
            icon={<MessageSquareWarning />}
            title="Wrong things AI assistants said about you"
            description="Statements from AI answers this month that don't match the facts on your website."
          />
          <CardBody>
            <ul className="space-y-3">
              {p.wrongAnswers.map((w, i) => (
                <li key={i} className="rounded-xl bg-danger-soft px-4 py-3 text-small">
                  <div className="text-xs font-semibold text-danger">{w.engine}</div>
                  <div className="mt-0.5 text-fg">{w.statement}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ---- attribution + notes ---- */}
      <div className="mr-avoid space-y-4">
        <Callout tone="neutral" title="How to read this report" icon={<Info />}>
          {p.attribution}
        </Callout>
        {p.notes.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
            <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
              <Sparkles aria-hidden className="size-4 text-muted" /> Notes on the data
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-fg-soft">
              {p.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted">
          Generated {day(p.generatedAt)} · {p.dataSources.crawlSnapshots} website scan{p.dataSources.crawlSnapshots === 1 ? "" : "s"} and{" "}
          {p.dataSources.visibilityRuns} AI check{p.dataSources.visibilityRuns === 1 ? "" : "s"} this month
          {p.dataSources.providers.length > 0 && ` · Engines: ${p.dataSources.providers.join(", ")}`}
        </p>
      </div>
    </div>
  );
}
