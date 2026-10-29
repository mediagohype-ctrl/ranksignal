"use client";
// Compact "Search performance" card: real Google Search Console + GA4 numbers stored by the daily sync.
// No sample or simulated data is ever shown; when nothing is connected it offers the connection instead.
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Search } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Skeleton } from "@/components/ui";
import type { Change, SearchSummary } from "@/lib/google/summary";

const int = (n: number) => n.toLocaleString("en-IN");
const pct1 = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false, axisLine: false } as const;

function ChangeChip({ c, invert = false }: { c: Change | { abs: number; pct: number | null } | null; invert?: boolean }) {
  if (!c) return null;
  if (c.pct === null) return <span className="text-xs text-muted">{c.abs > 0 ? "new" : "—"}</span>;
  const v = Math.round(c.pct * 100);
  const good = invert ? v < 0 : v > 0;
  const bad = invert ? v > 0 : v < 0;
  const Icon = v === 0 ? ArrowRight : v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good ? "text-success" : bad ? "text-danger" : "text-muted")}>
      <Icon aria-hidden className="size-3.5" />
      {v > 0 ? "+" : ""}
      {v}%<span className="sr-only">{good ? " (better)" : bad ? " (worse)" : ""}</span>
    </span>
  );
}

function Tile({ label, value, change, hint }: { label: string; value: string; change?: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="text-caption uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.02em] text-fg">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {change}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

function ClicksChart({ data }: { data: { date: string; clicks: number; impressions: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <div
      style={{ height: 180 }}
      role="img"
      aria-label={`Daily Google clicks and impressions, ${rows[0]?.label ?? ""} to ${rows.at(-1)?.label ?? ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={28} />
          <YAxis yAxisId="c" {...axis} width={44} allowDecimals={false} />
          <YAxis yAxisId="i" orientation="right" {...axis} width={48} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(v, name) => [int(Number(v)), String(name)]}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          <Line yAxisId="c" type="monotone" dataKey="clicks" name="Clicks" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line
            yAxisId="i"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SearchPerformance({
  projectId,
  days = 28,
  initial,
  className,
}: {
  projectId: string;
  /** Window ending yesterday (UTC). */
  days?: number;
  /** Server-loaded summary (skips the client fetch). */
  initial?: SearchSummary | null;
  className?: string;
}) {
  const [data, setData] = useState<SearchSummary | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    const to = new Date(Date.now() - 86_400_000);
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const q = new URLSearchParams({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    fetch(`/api/projects/${encodeURIComponent(projectId)}/search-metrics?${q}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!alive) return;
        if (!r.ok) setError(j?.error?.message ?? "Couldn't load search data.");
        else setData(j.item as SearchSummary);
      })
      .catch(() => alive && setError("Couldn't load search data."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [projectId, days, initial]);

  const g = data?.gsc ?? null;
  const a = data?.ga4 ?? null;
  const integrationsHref = `/app/projects/${projectId}/integrations`;

  return (
    <Card as="section" className={className} aria-labelledby="search-perf-title">
      <CardHeader
        icon={<Search />}
        title={<span id="search-perf-title">Search performance</span>}
        description={
          data
            ? `Last ${data.range.days} days (${shortDate(data.range.from)} – ${shortDate(data.range.to)}) vs the ${data.range.days} days before`
            : `Last ${days} days`
        }
        actions={
          <div className="flex flex-wrap gap-1.5">
            {g && <Badge tone="neutral" size="sm">Google data via your Search Console</Badge>}
            {a && <Badge tone="neutral" size="sm">GA4</Badge>}
          </div>
        }
      />
      <CardBody className="space-y-5">
        {loading ? (
          <div className="space-y-3" aria-busy>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : error ? (
          <p className="text-small text-danger">{error}</p>
        ) : !g && !a ? (
          <EmptyState
            size="sm"
            icon={<Search />}
            title="See your real Google clicks here"
            description="Connect Google Search Console and Google Analytics 4 (read-only) to track clicks, impressions and visits from AI assistants alongside the work we do."
            action={<LinkButton href={integrationsHref} size="sm">Connect Google</LinkButton>}
          />
        ) : (
          <>
            {g && (
              <div className="space-y-4">
                {g.hasData ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Tile label="Clicks" value={int(g.current.clicks)} change={<ChangeChip c={g.deltas.clicks} />} />
                      <Tile label="Impressions" value={int(g.current.impressions)} change={<ChangeChip c={g.deltas.impressions} />} />
                      <Tile
                        label="Click-through"
                        value={pct1(g.current.ctr)}
                        hint={g.previous.ctr !== null ? `was ${pct1(g.previous.ctr)}` : undefined}
                      />
                      <Tile
                        label="Avg. position"
                        value={g.current.position !== null ? String(g.current.position) : "—"}
                        hint={g.previous.position !== null ? `was ${g.previous.position} · lower is better` : "lower is better"}
                      />
                    </div>
                    {g.daily.length > 1 && <ClicksChart data={g.daily} />}
                    {g.topQueries.length > 0 && (
                      <div>
                        <h3 className="text-small font-semibold text-fg">Top searches</h3>
                        <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                          {g.topQueries.slice(0, 5).map((q) => (
                            <li key={q.key} className="flex items-center justify-between gap-3 px-3 py-2 text-small">
                              <span className="min-w-0 truncate text-fg-soft">{q.key}</span>
                              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                                <span className="font-medium text-fg">{int(q.clicks)}</span>
                                <span className={clsx("text-xs", q.clicksChange > 0 ? "text-success" : q.clicksChange < 0 ? "text-danger" : "text-muted")}>
                                  {q.previousClicks === 0 && q.clicks > 0 ? "new" : `${q.clicksChange > 0 ? "+" : ""}${q.clicksChange}`}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-muted">
                      Google data via your Search Console{g.siteUrl ? ` (${g.siteUrl})` : ""}. Google reports clicks 2–3 days late
                      {g.lastDataDate ? `; latest day: ${shortDate(g.lastDataDate)}` : ""}.
                    </p>
                  </>
                ) : (
                  <p className="text-small text-muted">
                    {g.connected
                      ? "Search Console is connected. The first data appears after the next daily sync (Google reports with a 2–3 day delay)."
                      : "Search Console isn't connected right now."}
                  </p>
                )}
              </div>
            )}

            {a && (
              <div className={clsx("space-y-3", g && "border-t border-border pt-4")}>
                {a.hasData ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Tile label="Website visits" value={int(a.current.sessions)} change={<ChangeChip c={a.deltas.sessions} />} hint="GA4 sessions" />
                      <Tile
                        label="Visits from AI assistants"
                        value={int(a.current.aiSessions)}
                        change={<ChangeChip c={a.deltas.aiSessions} />}
                        hint="GA4 referrals"
                      />
                      <Tile label="Key events" value={int(a.current.conversions)} change={<ChangeChip c={a.deltas.conversions} />} hint="GA4" />
                    </div>
                    {a.aiBySource.length > 0 && (
                      <ul className="flex flex-wrap gap-2 text-small" aria-label="Visits by AI assistant">
                        {a.aiBySource.map((x) => (
                          <li key={x.source} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                            <Bot aria-hidden className="size-3.5 text-muted" />
                            <span className="text-fg-soft">{x.label}</span>
                            <span className="font-semibold tabular-nums text-fg">{int(x.sessions)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted">
                      GA4{a.propertyName ? ` (${a.propertyName})` : ""}. AI-assistant visits count only people who clicked a link in ChatGPT,
                      Perplexity, Gemini, Copilot or Claude and arrived with that referrer.
                    </p>
                  </>
                ) : (
                  <p className="text-small text-muted">
                    {a.connected ? "GA4 is connected. Visits appear after the next daily sync." : "GA4 isn't connected right now."}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default SearchPerformance;
