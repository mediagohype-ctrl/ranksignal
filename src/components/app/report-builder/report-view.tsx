// A built client report: the agency's chosen sections in their chosen order, with the agency's white-label
// branding when branding.ts allows it. Server component (print page + public share page). Sections whose data
// doesn't exist are skipped (optional ones) or say plainly that nothing was measured — never sample numbers.
import type { PublicBranding } from "@/lib/branding";
import { BRAND } from "@/lib/brand";
import { fmtDate, hostOf, pct } from "@/lib/dashboard/format";
import type { BuilderReportData, ScorePoint } from "@/lib/report-builder/data";
import { SECTION_META, visibleSections, type SectionChoice, type SectionId } from "@/lib/report-builder/sections";
import { ScoreHistoryChart } from "@/components/app/charts";
import { PILLAR_SHORT } from "@/components/app/report/pillars";

const IMPACT_LABEL: Record<string, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };
const PERFORMER: Record<string, string> = { agency: "Done by us", client: "Done by you", system: "Applied automatically" };
const PILLARS = ["seo", "aeo", "geo", "brand"] as const;

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 mt-10 break-after-avoid border-b-2 border-fg pb-2 text-h2 text-fg">
      <span className="mr-2 text-muted">{n}.</span>
      {children}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-fg-soft">{children}</p>;
}

function Delta({ start, end, rate = false }: { start: number | null | undefined; end: number | null | undefined; rate?: boolean }) {
  if (typeof start !== "number" || typeof end !== "number") return null;
  const d = rate ? Math.round((end - start) * 100) : Math.round(end) - Math.round(start);
  if (d === 0) return <span className="ml-2 text-small text-muted">no change</span>;
  return (
    <span className={`ml-2 text-small font-semibold ${d > 0 ? "text-success" : "text-danger"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}
      {rate ? " pts" : ""}
    </span>
  );
}

const num = (n: number) => n.toLocaleString("en-IN");
const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);

function scoreOf(p: ScorePoint | null, key: "overall" | (typeof PILLARS)[number]) {
  return p ? p[key] : null;
}

function Section({ id, n, data, notes }: { id: SectionId; n: number; data: BuilderReportData; notes: string }): React.ReactNode {
  const r = data.report;
  const title = SECTION_META[id].label;
  switch (id) {
    case "executive_summary":
      return (
        <section>
          <H2 n={n}>{title}</H2>
          {r ? <p className="whitespace-pre-line text-body leading-relaxed text-fg-soft">{r.executiveSummary}</p> : <Empty>No website check has finished yet, so there&apos;s no summary.</Empty>}
        </section>
      );
    case "scores": {
      const { start, end } = data.scores;
      const overall = scoreOf(end, "overall") ?? r?.overall.score ?? null;
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          {overall === null ? (
            <Empty>No scores yet — they appear after the first website check.</Empty>
          ) : (
            <>
              <p className="text-5xl font-semibold tabular-nums text-fg">
                {overall}
                <span className="text-h3 text-muted"> / 100</span>
                <Delta start={scoreOf(start, "overall")} end={scoreOf(end, "overall")} />
              </p>
              {r && <p className="mt-1 text-h4 text-fg-soft">{r.overall.headline}</p>}
              <table className="mt-4 w-full max-w-lg border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-1.5 pr-3 font-semibold">Area</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Start</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">End</th>
                    <th className="py-1.5 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLARS.map((k) => (
                    <tr key={k} className="border-b border-border">
                      <td className="py-1.5 pr-3 font-medium text-fg">{PILLAR_SHORT[k]}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{scoreOf(start, k) ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{scoreOf(end, k) ?? "—"}</td>
                      <td className="py-1.5">
                        <Delta start={scoreOf(start, k)} end={scoreOf(end, k)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">
                Start = the last check before {fmtDate(`${data.range.firstDay}T00:00:00Z`)}
                {start ? ` (${fmtDate(start.at)})` : " (none)"}; end = the latest check up to {fmtDate(`${data.range.lastDay}T00:00:00Z`)}
                {end ? ` (${fmtDate(end.at)})` : ""}.
              </p>
            </>
          )}
        </section>
      );
    }
    case "score_history":
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          {data.history.length < 2 ? (
            <Empty>Not enough checks in these dates to draw a chart (we need at least two).</Empty>
          ) : (
            <ScoreHistoryChart
              height={280}
              data={data.history.map((h) => ({ t: Date.parse(h.at), overall: h.overall, seo: h.seo, aeo: h.aeo, geo: h.geo, brand: h.brand }))}
            />
          )}
        </section>
      );
    case "fixes_done": {
      const { shipped, resolved } = data.fixes;
      return (
        <section>
          <H2 n={n}>{title}</H2>
          {shipped.length === 0 && resolved.total === 0 ? (
            <Empty>No finished work or fixed problems were recorded in these dates.</Empty>
          ) : (
            <div className="space-y-5 text-small">
              {shipped.length > 0 && (
                <ul className="space-y-1.5">
                  {shipped.map((s, k) => (
                    <li key={k} className="break-inside-avoid border-b border-border pb-1.5">
                      <span className="font-medium text-fg">{s.title}</span>
                      <span className="text-muted">
                        {" "}
                        · {PERFORMER[s.performedBy] ?? s.performedBy} · {fmtDate(s.completedAt)}
                      </span>
                      {s.url && <span className="block break-all text-xs text-muted">{s.url}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {resolved.total > 0 && (
                <div className="break-inside-avoid">
                  <p className="font-semibold text-fg">
                    {resolved.total} {resolved.total === 1 ? "problem" : "problems"} went away in these dates
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-soft">
                    {resolved.top.map((f, k) => (
                      <li key={k}>
                        {f.message}
                        {f.count > 1 && <span className="text-muted"> ({f.count} pages)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      );
    }
    case "open_problems": {
      const issues = r?.issues ?? [];
      return (
        <section>
          <H2 n={n}>{title}</H2>
          {!r ? (
            <Empty>No website check has finished yet.</Empty>
          ) : issues.length === 0 ? (
            <Empty>No open problems in the latest website check.</Empty>
          ) : (
            <ol className="space-y-3">
              {issues.slice(0, 15).map((i) => (
                <li key={i.id} className="break-inside-avoid rounded-lg border border-border p-3 text-small">
                  <p className="text-xs font-semibold text-muted">
                    {IMPACT_LABEL[i.impact] ?? i.impact} · {PILLAR_SHORT[i.pillar]}
                    {i.affectedCount > 0 && ` · ${i.affectedCount} ${i.affectedCount === 1 ? "page" : "pages"}`}
                  </p>
                  <p className="mt-0.5 font-semibold text-fg">{i.title}</p>
                  <p className="mt-1 text-fg-soft">{i.whatsWrong}</p>
                </li>
              ))}
              {issues.length > 15 && <li className="text-xs text-muted">…and {issues.length - 15} smaller problems.</li>}
            </ol>
          )}
        </section>
      );
    }
    case "ai_visibility": {
      const ai = r?.aiVisibility;
      const { start, end } = data.scores;
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          {!ai?.measured ? (
            <Empty>AI answers haven&apos;t been checked yet.</Empty>
          ) : (
            <div className="space-y-3 text-small">
              <p className="text-fg-soft">
                Based on {ai.collected ?? ai.sampleSize} AI answers{ai.providers.length > 0 && ` from ${ai.providers.join(", ")}`}
                {ai.measuredAt && `, collected ${fmtDate(ai.measuredAt)}`}.{ai.simulated && " Some answers are sample (simulated) data, not real AI answers."}
              </p>
              <table className="w-full max-w-md border-collapse text-left">
                <tbody>
                  {[
                    ["Named you", pct(ai.mentionRate)],
                    ["Recommended you", pct(ai.recommendationRate)],
                    ["Linked to your site", pct(ai.citationRate)],
                    ["AI visibility score", ai.visibilityIndex === null ? "—" : `${Math.round(ai.visibilityIndex)} / 100`],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-border">
                      <td className="py-1.5 pr-4 text-fg-soft">{k}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {typeof scoreOf(end, "geo") === "number" && (
                <p className="text-fg-soft">
                  GEO score over these dates: {scoreOf(start, "geo") ?? "—"} → {scoreOf(end, "geo")}
                  <Delta start={scoreOf(start, "geo")} end={scoreOf(end, "geo")} />
                </p>
              )}
              {ai.promptsWhereMissing.length > 0 && (
                <div>
                  <p className="font-semibold text-fg">Questions where you weren&apos;t named</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-soft">
                    {ai.promptsWhereMissing.slice(0, 8).map((m) => (
                      <li key={m.prompt}>“{m.prompt}”</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      );
    }
    case "competitors": {
      const ai = r?.aiVisibility;
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          {!ai?.measured || ai.topCompetitors.length === 0 ? (
            <Empty>No competitors were named in the AI answers we checked.</Empty>
          ) : (
            <div className="text-small">
              {typeof ai.brandShare === "number" && (
                <p className="mb-2 text-fg-soft">
                  Your share of all businesses AI assistants named: <strong className="text-fg">{pct(ai.brandShare)}</strong>
                </p>
              )}
              <table className="w-full max-w-md border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-1.5 pr-3 font-semibold">Competitor</th>
                    <th className="py-1.5 text-right font-semibold">Share of mentions</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.topCompetitors.slice(0, 10).map((c) => (
                    <tr key={c.name} className="border-b border-border">
                      <td className="py-1.5 pr-3 text-fg">{c.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{pct(c.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      );
    }
    case "search_console": {
      const g = data.search;
      if (!g) return null;
      const d = g.deltas;
      const change = (c: { pct: number | null }) => (c.pct === null ? "" : ` (${c.pct >= 0 ? "+" : ""}${Math.round(c.pct * 100)}% vs the period before)`);
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          <div className="space-y-3 text-small">
            <table className="w-full max-w-lg border-collapse text-left">
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-1.5 pr-4 text-fg-soft">Clicks from Google</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {num(g.current.clicks)}
                    <span className="font-normal text-muted">{change(d.clicks)}</span>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-1.5 pr-4 text-fg-soft">Times shown on Google</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {num(g.current.impressions)}
                    <span className="font-normal text-muted">{change(d.impressions)}</span>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-1.5 pr-4 text-fg-soft">Average position</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{g.current.position ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            {g.topQueries.length > 0 && (
              <div>
                <p className="font-semibold text-fg">Top searches</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fg-soft">
                  {g.topQueries.slice(0, 10).map((q) => (
                    <li key={q.key}>
                      “{q.key}” — {num(q.clicks)} {q.clicks === 1 ? "click" : "clicks"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted">Source: Google Search Console{g.lastDataDate ? `, data up to ${fmtDate(`${g.lastDataDate}T00:00:00Z`)}` : ""}. Search Console data is 2–3 days behind.</p>
          </div>
        </section>
      );
    }
    case "core_web_vitals": {
      const v = data.vitals;
      if (!v || v.length === 0) return null;
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-1.5 pr-3 font-semibold">Page</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Speed score</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Main content shows (LCP)</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Response to taps (INP)</th>
                <th className="py-1.5 text-right font-semibold">Layout jumps (CLS)</th>
              </tr>
            </thead>
            <tbody>
              {v.map((x, k) => (
                <tr key={k} className="border-b border-border align-top">
                  <td className="break-all py-1.5 pr-3 text-fg">
                    {x.isHome ? "Home page" : x.url} <span className="text-xs text-muted">({x.strategy}, {x.source === "field" ? "real visitors" : "lab test"})</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{x.performanceScore ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{seconds(x.lcpMs)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{x.inpMs === null ? "—" : `${x.inpMs} ms`}</td>
                  <td className="py-1.5 text-right tabular-nums">{x.cls === null ? "—" : x.cls.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Source: Google PageSpeed Insights. Good targets: LCP under 2.5 s, INP under 200 ms, CLS under 0.1.</p>
        </section>
      );
    }
    case "agency_notes":
      if (!notes.trim()) return null;
      return (
        <section className="break-inside-avoid">
          <H2 n={n}>{title}</H2>
          <p className="whitespace-pre-line text-body leading-relaxed text-fg-soft">{notes}</p>
        </section>
      );
  }
}

export function BuiltReport({
  data,
  sections,
  intro,
  notes,
  branding,
}: {
  data: BuilderReportData;
  sections: SectionChoice[];
  intro: string;
  notes: string;
  branding: PublicBranding;
}) {
  const ids = visibleSections(sections, data, notes);
  const by = branding.custom ? branding.displayName : BRAND.name;
  const showPoweredBy = !branding.custom || !branding.hidePoweredBy;
  return (
    <article className="text-fg">
      <header className="break-inside-avoid border-b border-border pb-6">
        {branding.custom && branding.accentColor && <div aria-hidden className="mb-4 h-1 rounded" style={{ background: branding.accentColor }} />}
        <div className="flex flex-wrap items-center gap-3">
          {branding.custom && branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- agency logo from a validated https:// URL
            <img src={branding.logoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-auto max-w-45 object-contain" />
          )}
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-primary" style={branding.custom && branding.accentColor ? { color: branding.accentColor } : undefined}>
            {by} · Client report
          </p>
        </div>
        <h1 className="mt-3 text-h1 text-fg">
          {data.project.name} <span className="text-muted">— {hostOf(data.project.websiteUrl)}</span>
        </h1>
        <p className="mt-2 text-small text-muted">
          {data.range.label} · Prepared {fmtDate(data.generatedAt, true)}
        </p>
        {intro.trim() && <p className="mt-5 whitespace-pre-line text-body leading-relaxed text-fg-soft">{intro}</p>}
      </header>

      {ids.length === 0 ? (
        <p className="mt-8 text-body text-fg-soft">No sections are switched on for this report.</p>
      ) : (
        ids.map((id, k) => <Section key={id} id={id} n={k + 1} data={data} notes={notes} />)
      )}

      <footer className="mt-12 break-inside-avoid border-t border-border pt-4 text-xs text-muted">
        <p>
          Scores are estimates from the pages we could read and a sample of AI answers; they don&apos;t guarantee rankings or AI placements. Work done
          and measured changes are shown side by side; one didn&apos;t necessarily cause the other.
        </p>
        <p className="mt-1">
          Report by {by}
          {branding.custom && branding.footerText && <> · {branding.footerText}</>}
          {showPoweredBy && branding.custom && <> · Powered by {BRAND.name}</>}
        </p>
      </footer>
    </article>
  );
}
