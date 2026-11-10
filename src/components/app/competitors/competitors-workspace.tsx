"use client";
// Competitors workspace: traffic estimates, keyword gap, side-by-side comparison + batch traffic, suggested competitors.
// Shows cached snapshots only; every DataForSEO call is an explicit button press that says how much allowance it uses.
import { useMemo, useState } from "react";
import { Check, Download, ListPlus, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Meter, Notice, Select, Table, Tabs, TabPanel, TD, TH, THead, TR, Textarea,
} from "@/components/ui";
import { useTimeZone } from "@/components/app/time-zone";
import { fmtDate } from "@/lib/dashboard/format";
import {
  ESTIMATE_NOTE, GAP_TOP, MAX_COMPARE_DOMAINS, MAX_TRAFFIC_DOMAINS, UNITS, batchCsv, batchUnits, gapCsv, parseDomainList, usdToInr,
  type DomainOverview,
} from "@/lib/competitors/shared";
import type { CompetitorFeature, CompetitorsView, SnapshotView } from "@/lib/competitors/service";
import { normaliseDomain } from "@/lib/dataforseo/locations";

type TabId = "traffic" | "gap" | "compare" | "batch";

async function api<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = typeof j?.message === "string" ? j.message : typeof j?.error?.message === "string" ? j.error.message : null;
    throw new Error(msg ?? "Something went wrong. Please try again.");
  }
  return j as T;
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-IN"));
const inr = (usd: number | null | undefined, rate: number) => {
  const v = usdToInr(usd ?? null, rate);
  return v === null ? "—" : `₹${v.toLocaleString("en-IN")}`;
};

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function difficultyLabel(d: number | null): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (d === null) return { label: "—", tone: "neutral" };
  if (d < 30) return { label: `Easy · ${d}`, tone: "success" };
  if (d < 60) return { label: `Medium · ${d}`, tone: "warning" };
  return { label: `Hard · ${d}`, tone: "danger" };
}

const FEATURE_LABEL: Record<CompetitorFeature, string> = {
  competitor_traffic: "Traffic checks",
  keyword_gap: "Keyword gap",
  domain_compare: "Compare & batch",
};

function Allowance({ view }: { view: CompetitorsView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(FEATURE_LABEL) as CompetitorFeature[]).map((f) => {
        const a = view.allowances[f];
        return (
          <div key={f} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2 text-small">
              <span className="font-medium text-fg">{FEATURE_LABEL[f]}</span>
              <span className="tabular-nums text-muted">
                {a.limit === 0 ? "Not on your plan" : `${a.used} of ${a.limit} used this month`}
              </span>
            </div>
            <Meter className="mt-2" value={a.used} max={Math.max(1, a.limit)} label={`${FEATURE_LABEL[f]} used this month`} />
          </div>
        );
      })}
    </div>
  );
}

/** Pick domains: your site + saved competitors as checkboxes, plus typed extras. */
function DomainPicker({
  view, selected, setSelected, max, idPrefix,
}: {
  view: CompetitorsView;
  selected: string[];
  setSelected: (d: string[]) => void;
  max: number;
  idPrefix: string;
}) {
  const [typed, setTyped] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const options = [...(view.ownDomain ? [view.ownDomain] : []), ...view.saved, ...extra.filter((d) => d !== view.ownDomain && !view.saved.includes(d))];
  const toggle = (d: string) =>
    setSelected(selected.includes(d) ? selected.filter((x) => x !== d) : selected.length >= max ? selected : [...selected, d]);
  function add(e: React.FormEvent) {
    e.preventDefault();
    const d = normaliseDomain(typed);
    if (!d) return setErr("Enter a website address like example.com");
    setErr(null);
    setTyped("");
    if (!options.includes(d)) setExtra([...extra, d]);
    if (!selected.includes(d) && selected.length < max) setSelected([...selected, d]);
  }
  return (
    <div className="space-y-3">
      {options.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-small text-muted">Choose up to {max} websites ({selected.length} chosen)</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((d) => {
              const on = selected.includes(d);
              return (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-small ${on ? "border-primary bg-primary-soft text-fg" : "border-border text-fg-soft"}`}
                >
                  <input type="checkbox" className="size-4" checked={on} disabled={!on && selected.length >= max} onChange={() => toggle(d)} />
                  <span className="break-all">{d}</span>
                  {d === view.ownDomain && <Badge size="sm" tone="info">You</Badge>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`${idPrefix}-add`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Add another website, e.g. rivalstore.in"
          aria-label="Add another website"
          maxLength={300}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!typed.trim()}>
          Add
        </Button>
      </form>
      {err && <p className="text-small text-danger">{err}</p>}
    </div>
  );
}

function Updated({ at, tz, onRefresh, busy, canSpend, uses }: { at: string; tz: string; onRefresh?: () => void; busy?: boolean; canSpend: boolean; uses: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-small text-muted">
      <span>Updated {fmtDate(at, false, tz)}</span>
      {onRefresh && canSpend && (
        <Button size="xs" variant="ghost" icon={<RefreshCw />} loading={busy} onClick={onRefresh}>
          Refresh (uses {uses})
        </Button>
      )}
    </div>
  );
}

export function CompetitorsWorkspace({ projectId, initial, canSpend }: { projectId: string; initial: CompetitorsView; canSpend: boolean }) {
  const tz = useTimeZone();
  const [view, setView] = useState(initial);
  const [tab, setTab] = useState<TabId>("traffic");
  const [locationId, setLocationId] = useState("in");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const live = canSpend && view.configured;
  const market = `|${locationId}|${language}`;
  const base = `/api/projects/${projectId}/competitors`;
  const rate = view.usdInrRate;

  async function run(key: string, path: string, body: Record<string, unknown>, after?: (result: unknown) => void) {
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      const r = await api<{ result: unknown; item: CompetitorsView }>(`${base}${path}`, { ...body, locationId, language });
      setView(r.item);
      after?.(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const tabs = [
    { id: "traffic", label: "Traffic" },
    { id: "gap", label: "Keyword gap" },
    { id: "compare", label: "Compare" },
    { id: "batch", label: "Batch" },
  ];

  return (
    <div className="space-y-5">
      {!view.configured && <Notice tone="warning">Live competitor data is paused on this server, so you can see earlier results but not refresh them.</Notice>}
      <Notice tone="neutral" title="These are estimates">
        {ESTIMATE_NOTE} Use them to compare websites with each other, not as exact visitor numbers.
      </Notice>
      <Allowance view={view} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="text-small text-muted">
          Country
          <Select className="mt-1" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Country">
            {view.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-small text-muted">
          Language
          <Select className="mt-1" value={language} onChange={(e) => setLanguage(e.target.value === "hi" ? "hi" : "en")} aria-label="Language">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </Select>
        </label>
        <p className="text-xs text-muted sm:pb-2">Competitor data is by country, not by city.</p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}

      <div>
        <Tabs tabs={tabs} value={tab} onChange={(t) => setTab(t as TabId)} label="Competitor tools" idPrefix="comp" />
        <TabPanel idPrefix="comp" value={tab}>
          {tab === "traffic" && <TrafficTab {...{ view, market, live, busy, run, rate, tz }} />}
          {tab === "gap" && <GapTab {...{ view, market, live, busy, run, tz, projectId, locationId, setError }} />}
          {tab === "compare" && <CompareTab {...{ view, market, live, busy, run, rate, tz, canSpend, setInfo, setError, setView, base }} />}
          {tab === "batch" && <BatchTab {...{ view, market, live, busy, run, rate, tz }} />}
        </TabPanel>
      </div>
    </div>
  );
}

type Run = (key: string, path: string, body: Record<string, unknown>, after?: (result: unknown) => void) => Promise<void>;

function defaultSelection(view: CompetitorsView, max: number) {
  return [...(view.ownDomain ? [view.ownDomain] : []), ...view.saved].slice(0, max);
}

// ---------- Traffic ----------

function TrafficTab({ view, market, live, busy, run, rate, tz }: { view: CompetitorsView; market: string; live: boolean; busy: string | null; run: Run; rate: number; tz: string }) {
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(view, MAX_TRAFFIC_DOMAINS));
  const [focus, setFocus] = useState<string | null>(null);
  const rows = useMemo(() => {
    const own = view.ownDomain;
    const known = new Set([own, ...view.saved]);
    return view.overviews
      .filter((o) => o.key.endsWith(market))
      .sort((a, b) => (a.data.domain === own ? -1 : b.data.domain === own ? 1 : 0) || Number(known.has(b.data.domain)) - Number(known.has(a.data.domain)) || (b.data.traffic ?? 0) - (a.data.traffic ?? 0));
  }, [view, market]);
  const top = focus ? view.topKeywords.find((t) => t.key === `${focus}${market}`) : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Check estimated Google traffic" description="Monthly visits from Google, how many searches each website ranks for, and what that traffic would cost as ads." />
        <CardBody className="space-y-4">
          <DomainPicker view={view} selected={selected} setSelected={setSelected} max={MAX_TRAFFIC_DOMAINS} idPrefix="traffic" />
          {live && (
            <Button
              icon={<Search />}
              loading={busy === "traffic"}
              disabled={selected.length === 0 || busy !== null}
              onClick={() => run("traffic", "/traffic", { domains: selected })}
            >
              Check traffic (uses {selected.length * UNITS.trafficPerDomain})
            </Button>
          )}
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <EmptyState bordered picture="chart" title="No traffic checked yet for this country." description="Pick your website and competitors above, then press Check traffic." />
      ) : (
        <Card>
          <CardHeader title="Estimated traffic" description="Top 3 / top 10 / top 100 = number of Google searches where the website shows in those positions." />
          <TrafficTable rows={rows} view={view} rate={rate} tz={tz} live={live} busy={busy} market={market} run={run} onTop={setFocus} focus={focus} />
        </Card>
      )}

      {focus && (
        <Card>
          <CardHeader
            title={`Top keywords and pages: ${focus}`}
            description="The searches that bring this website the most estimated visits, and the pages that get them."
          />
          <CardBody className="space-y-4">
            {top ? (
              <>
                <Updated at={top.updatedAt} tz={tz} canSpend={live} uses={UNITS.topKeywords} busy={busy === `top:${focus}`} onRefresh={() => run(`top:${focus}`, "/top-keywords", { domain: focus })} />
                {top.data.totalKeywords !== null && <p className="text-small text-muted">Ranks for about {n(top.data.totalKeywords)} searches in total. Showing the top {top.data.keywords.length}.</p>}
                <TopKeywordsTables data={top.data} />
              </>
            ) : live ? (
              <Button icon={<Search />} loading={busy === `top:${focus}`} disabled={busy !== null} onClick={() => run(`top:${focus}`, "/top-keywords", { domain: focus })}>
                Show top keywords and pages (uses {UNITS.topKeywords})
              </Button>
            ) : (
              <p className="text-small text-muted">Not checked yet.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TrafficTable({
  rows, view, rate, tz, live, busy, market, run, onTop, focus,
}: {
  rows: SnapshotView<DomainOverview>[];
  view: CompetitorsView;
  rate: number;
  tz: string;
  live: boolean;
  busy: string | null;
  market: string;
  run: Run;
  onTop: (d: string) => void;
  focus: string | null;
}) {
  const label = (d: string) => (d === view.ownDomain ? <Badge size="sm" tone="info">You</Badge> : null);
  const hasTop = (d: string) => view.topKeywords.some((t) => t.key === `${d}${market}`);
  return (
    <>
      <ul className="divide-y divide-border md:hidden">
        {rows.map(({ data: o, updatedAt }) => (
          <li key={o.domain} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 font-medium text-fg">
              <span className="break-all">{o.domain}</span> {label(o.domain)}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-small">
              <dt className="text-muted">Visits / month</dt>
              <dd className="tabular-nums">{n(o.traffic)}</dd>
              <dt className="text-muted">Top 3 / 10 / 100</dt>
              <dd className="tabular-nums">{n(o.top3)} / {n(o.top10)} / {n(o.top100)}</dd>
              <dt className="text-muted">Traffic value</dt>
              <dd className="tabular-nums">{inr(o.trafficValueUsd, rate)}</dd>
              <dt className="text-muted">Updated</dt>
              <dd>{fmtDate(updatedAt, false, tz)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant={focus === o.domain ? "primary" : "secondary"} onClick={() => onTop(o.domain)}>
                {hasTop(o.domain) ? "Top keywords & pages" : "See top keywords"}
              </Button>
              {live && (
                <Button size="xs" variant="ghost" icon={<RefreshCw />} loading={busy === `row:${o.domain}`} disabled={busy !== null} onClick={() => run(`row:${o.domain}`, "/traffic", { domains: [o.domain] })}>
                  Refresh (uses 1)
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table caption="Estimated traffic by website">
          <THead>
            <tr>
              <TH>Website</TH>
              <TH align="right">Visits / month</TH>
              <TH align="right">Top 3</TH>
              <TH align="right">Top 10</TH>
              <TH align="right">Top 100</TH>
              <TH align="right">Traffic value / month</TH>
              <TH>Updated</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <tbody>
            {rows.map(({ data: o, updatedAt }) => (
              <TR key={o.domain}>
                <TD className="font-medium text-fg">
                  <span className="break-all">{o.domain}</span> {label(o.domain)}
                </TD>
                <TD numeric>{n(o.traffic)}</TD>
                <TD numeric>{n(o.top3)}</TD>
                <TD numeric>{n(o.top10)}</TD>
                <TD numeric>{n(o.top100)}</TD>
                <TD numeric>{inr(o.trafficValueUsd, rate)}</TD>
                <TD className="whitespace-nowrap">{fmtDate(updatedAt, false, tz)}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant={focus === o.domain ? "primary" : "secondary"} onClick={() => onTop(o.domain)}>
                      Top keywords
                    </Button>
                    {live && (
                      <Button size="xs" variant="ghost" icon={<RefreshCw />} aria-label={`Refresh ${o.domain} (uses 1)`} loading={busy === `row:${o.domain}`} disabled={busy !== null} onClick={() => run(`row:${o.domain}`, "/traffic", { domains: [o.domain] })} />
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function TopKeywordsTables({ data }: { data: { keywords: { keyword: string; position: number | null; volume: number | null; traffic: number | null; url: string | null }[]; pages: { url: string; traffic: number; keywords: number }[] } }) {
  if (data.keywords.length === 0) return <p className="text-small text-muted">Google doesn&apos;t show this website for any tracked searches in this country yet.</p>;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-small font-semibold text-fg">Top keywords</h3>
        <Table framed density="compact" maxHeight="28rem" stickyHeader caption="Top keywords">
          <THead>
            <tr>
              <TH>Search</TH>
              <TH align="right">Position</TH>
              <TH align="right">Searches / month</TH>
              <TH align="right">Est. visits</TH>
            </tr>
          </THead>
          <tbody>
            {data.keywords.map((k) => (
              <TR key={k.keyword}>
                <TD className="text-fg">{k.keyword}</TD>
                <TD numeric>{n(k.position)}</TD>
                <TD numeric>{n(k.volume)}</TD>
                <TD numeric>{n(k.traffic)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
      <div>
        <h3 className="mb-2 text-small font-semibold text-fg">Top pages</h3>
        <Table framed density="compact" maxHeight="28rem" stickyHeader caption="Top pages">
          <THead>
            <tr>
              <TH>Page</TH>
              <TH align="right">Est. visits</TH>
              <TH align="right">Keywords</TH>
            </tr>
          </THead>
          <tbody>
            {data.pages.map((p) => (
              <TR key={p.url}>
                <TD className="max-w-[16rem] break-all text-fg">{p.url}</TD>
                <TD numeric>{n(p.traffic)}</TD>
                <TD numeric>{n(p.keywords)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

// ---------- Keyword gap ----------

function GapTab({
  view, market, live, busy, run, tz, projectId, locationId, setError,
}: {
  view: CompetitorsView;
  market: string;
  live: boolean;
  busy: string | null;
  run: Run;
  tz: string;
  projectId: string;
  locationId: string;
  setError: (s: string | null) => void;
}) {
  const [competitor, setCompetitor] = useState<string>(view.saved[0] ?? "");
  const [typed, setTyped] = useState("");
  const [tracked, setTracked] = useState<Record<string, "busy" | "done">>({});
  const own = view.ownDomain;
  const gap = own && competitor ? view.gaps.find((g) => g.key === `${competitor}>${own}${market}`) : undefined;

  async function track(keyword: string) {
    setTracked((t) => ({ ...t, [keyword]: "busy" }));
    setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/rankings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keywords: [keyword], locationId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error?.message ?? j?.message ?? "Couldn't start tracking this keyword.");
      if (j && typeof j.added === "number" && j.added === 0 && typeof j.limit === "number") {
        // Already tracked, or the plan's tracked-keyword limit is reached.
        setError(`Not added: it's already tracked, or you've reached your limit of ${j.limit} tracked keywords.`);
      }
      setTracked((t) => ({ ...t, [keyword]: "done" }));
    } catch (e) {
      setTracked((t) => {
        const next = { ...t };
        delete next[keyword];
        return next;
      });
      setError((e as Error).message);
    }
  }

  if (!own) return <EmptyState bordered picture="search" title="Add your website address in project settings to find keyword gaps." />;
  const options = view.saved;
  function applyTyped(e: React.FormEvent) {
    e.preventDefault();
    const d = normaliseDomain(typed);
    if (!d) return setError("Enter a website address like example.com");
    if (d === own) return setError("Pick a competitor's website, not your own.");
    setError(null);
    setCompetitor(d);
    setTyped("");
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Keywords your competitor wins and you don't"
          description={`Searches where the competitor is in Google's top ${GAP_TOP} and ${own} isn't (or is lower than ${GAP_TOP}), biggest first. These are your best ideas for new pages or better content.`}
        />
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {options.length > 0 && (
              <label className="text-small text-muted sm:w-72">
                Saved competitor
                <Select className="mt-1" value={options.includes(competitor) ? competitor : ""} onChange={(e) => setCompetitor(e.target.value)}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {options.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <form onSubmit={applyTyped} className="flex flex-1 gap-2">
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a website, e.g. rivalstore.in" aria-label="Competitor website" maxLength={300} className="flex-1" />
              <Button type="submit" variant="secondary" disabled={!typed.trim()}>
                Use
              </Button>
            </form>
          </div>
          {competitor && <p className="text-small text-fg">Comparing <strong>{competitor}</strong> with <strong>{own}</strong>.</p>}
          {live && competitor && !gap && (
            <Button icon={<Search />} loading={busy === "gap"} disabled={busy !== null} onClick={() => run("gap", "/gap", { competitor })}>
              Find keyword gap (uses {UNITS.gap})
            </Button>
          )}
        </CardBody>
      </Card>

      {!competitor ? (
        <EmptyState bordered picture="search" title="Choose a competitor to see the keywords they win and you don't." />
      ) : !gap ? (
        <EmptyState bordered picture="search" title={`No keyword gap checked yet for ${competitor} in this country.`} />
      ) : (
        <Card>
          <CardHeader
            title={`${gap.data.rows.length} keyword${gap.data.rows.length === 1 ? "" : "s"} to go after`}
            description="Difficulty is 0–100: how hard it is to reach Google's first page. Start with high searches and low difficulty."
            actions={
              gap.data.rows.length > 0 ? (
                <Button size="sm" variant="secondary" icon={<Download />} onClick={() => download(`keyword-gap-${competitor}.csv`, gapCsv(gap.data.rows))}>
                  CSV
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-3">
            <Updated at={gap.updatedAt} tz={tz} canSpend={live} uses={UNITS.gap} busy={busy === "gap"} onRefresh={() => run("gap", "/gap", { competitor })} />
            {gap.data.partial && <Notice tone="warning">Only part of the gap loaded (keywords where you don&apos;t rank at all). Refresh to try again.</Notice>}
            {gap.data.rows.length === 0 ? (
              <p className="text-small text-muted">No gap found: you already rank in the top {GAP_TOP} wherever this competitor does, or Google shows them for very few searches.</p>
            ) : (
              <>
                <ul className="divide-y divide-border rounded-xl border border-border md:hidden">
                  {gap.data.rows.map((r) => {
                    const d = difficultyLabel(r.difficulty);
                    return (
                      <li key={r.keyword} className="space-y-1.5 px-4 py-3">
                        <div className="font-medium text-fg">{r.keyword}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-small text-muted">
                          <span>{n(r.volume)} searches/mo</span>
                          <span>They: #{n(r.competitorPosition)}</span>
                          <span>You: {r.yourPosition ? `#${r.yourPosition}` : "not in top 100"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Badge size="sm" tone={d.tone}>{d.label}</Badge>
                          <TrackButton state={tracked[r.keyword]} onClick={() => track(r.keyword)} disabled={!live} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden md:block">
                  <Table framed density="compact" maxHeight="36rem" stickyHeader caption="Keyword gap">
                    <THead>
                      <tr>
                        <TH>Search</TH>
                        <TH align="right">Searches / month</TH>
                        <TH>Difficulty</TH>
                        <TH align="right">Their position</TH>
                        <TH align="right">Your position</TH>
                        <TH>
                          <span className="sr-only">Track</span>
                        </TH>
                      </tr>
                    </THead>
                    <tbody>
                      {gap.data.rows.map((r) => {
                        const d = difficultyLabel(r.difficulty);
                        return (
                          <TR key={r.keyword}>
                            <TD className="text-fg">
                              {r.keyword}
                              {r.competitorUrl && <div className="max-w-[22rem] truncate text-xs text-muted" title={r.competitorUrl}>{r.competitorUrl}</div>}
                            </TD>
                            <TD numeric>{n(r.volume)}</TD>
                            <TD>
                              <Badge size="sm" tone={d.tone}>{d.label}</Badge>
                            </TD>
                            <TD numeric>{n(r.competitorPosition)}</TD>
                            <TD numeric>{r.yourPosition ?? "not in top 100"}</TD>
                            <TD align="right">
                              <TrackButton state={tracked[r.keyword]} onClick={() => track(r.keyword)} disabled={!live} />
                            </TD>
                          </TR>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TrackButton({ state, onClick, disabled }: { state?: "busy" | "done"; onClick: () => void; disabled: boolean }) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-small text-success">
        <Check className="size-4" aria-hidden /> Tracking
      </span>
    );
  }
  return (
    <Button size="xs" variant="secondary" icon={<ListPlus />} loading={state === "busy"} disabled={disabled} onClick={onClick}>
      Track this keyword
    </Button>
  );
}

// ---------- Compare + suggestions ----------

function CompareTab({
  view, market, live, busy, run, rate, tz, canSpend, setInfo, setError, setView, base,
}: {
  view: CompetitorsView;
  market: string;
  live: boolean;
  busy: string | null;
  run: Run;
  rate: number;
  tz: string;
  canSpend: boolean;
  setInfo: (s: string | null) => void;
  setError: (s: string | null) => void;
  setView: (v: CompetitorsView) => void;
  base: string;
}) {
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(view, MAX_COMPARE_DOMAINS));
  const [adding, setAdding] = useState<string | null>(null);
  const cmp = view.compare && view.compare.key === "latest" && `|${view.compare.locationId}|${view.compare.language}` === market ? view.compare : null;
  const overviewFor = (d: string) => view.overviews.find((o) => o.key === `${d}${market}`)?.data;
  const sugg = view.ownDomain ? view.suggestions.find((s) => s.key === `${view.ownDomain}${market}`) : undefined;

  async function addCompetitor(domain: string) {
    setAdding(domain);
    setError(null);
    setInfo(null);
    try {
      const r = await api<{ added: boolean; item: CompetitorsView }>(`${base}/suggestions/add`, { domain });
      setView(r.item);
      setInfo(r.added ? `${domain} was added to your competitors.` : `${domain} is already in your competitors.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(null);
    }
  }

  const metrics: { label: string; value: (d: string) => string }[] = cmp
    ? [
        { label: "Visits / month", value: (d) => n(cmp.data.rows.find((r) => r.domain === d)?.traffic) },
        { label: "Keywords ranking (top 100)", value: (d) => n(cmp.data.rows.find((r) => r.domain === d)?.keywords) },
        { label: "Traffic value / month", value: (d) => inr(cmp.data.rows.find((r) => r.domain === d)?.trafficValueUsd, rate) },
        { label: "Keywords in top 3", value: (d) => n(overviewFor(d)?.top3) },
        { label: "Keywords in top 10", value: (d) => n(overviewFor(d)?.top10) },
      ]
    : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Side-by-side comparison" description={`Compare up to ${MAX_COMPARE_DOMAINS} websites at once.`} />
        <CardBody className="space-y-4">
          <DomainPicker view={view} selected={selected} setSelected={setSelected} max={MAX_COMPARE_DOMAINS} idPrefix="compare" />
          {live && (
            <Button icon={<Search />} loading={busy === "compare"} disabled={selected.length < 2 || busy !== null} onClick={() => run("compare", "/compare", { domains: selected })}>
              Compare (uses {UNITS.compare})
            </Button>
          )}
        </CardBody>
      </Card>

      {!cmp ? (
        <EmptyState bordered picture="chart" title="No comparison yet for this country." description="Choose two to five websites above and press Compare." />
      ) : (
        <Card>
          <CardHeader title="Comparison" description="Top 3 and top 10 come from each website's last traffic check (Traffic tab); “—” means not checked yet." />
          <CardBody className="space-y-3">
            <Updated at={cmp.updatedAt} tz={tz} canSpend={live} uses={UNITS.compare} busy={busy === "compare"} onRefresh={() => run("compare", "/compare", { domains: cmp.data.domains })} />
            <div className="grid gap-3 md:hidden">
              {cmp.data.domains.map((d) => (
                <div key={d} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 font-medium text-fg">
                    <span className="break-all">{d}</span>
                    {d === view.ownDomain && <Badge size="sm" tone="info">You</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-small">
                    {metrics.map((m) => (
                      <div key={m.label} className="contents">
                        <dt className="text-muted">{m.label}</dt>
                        <dd className="tabular-nums">{m.value(d)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table framed caption="Side-by-side comparison">
                <THead>
                  <tr>
                    <TH>
                      <span className="sr-only">Measure</span>
                    </TH>
                    {cmp.data.domains.map((d) => (
                      <TH key={d} align="right" className="normal-case">
                        {d}
                        {d === view.ownDomain ? " (you)" : ""}
                      </TH>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {metrics.map((m) => (
                    <TR key={m.label}>
                      <TH scope="row" className="font-medium normal-case text-fg">
                        {m.label}
                      </TH>
                      {cmp.data.domains.map((d) => (
                        <TD key={d} numeric>
                          {m.value(d)}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="text-xs text-muted">A &ldquo;domain rank&rdquo; score isn&apos;t part of this data, so we don&apos;t show one.</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Competitors you might have missed"
          description="Websites that show up on Google for many of the same searches as yours. Big sites like Wikipedia, YouTube and marketplaces are left out."
        />
        <CardBody className="space-y-3">
          {!view.ownDomain ? (
            <p className="text-small text-muted">Add your website address in project settings first.</p>
          ) : sugg ? (
            <>
              <Updated at={sugg.updatedAt} tz={tz} canSpend={live} uses={UNITS.suggestions} busy={busy === "suggest"} onRefresh={() => run("suggest", "/suggestions", {})} />
              {sugg.data.items.length === 0 ? (
                <p className="text-small text-muted">No new competitors found for this country.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {sugg.data.items.map((s) => {
                    const saved = view.saved.includes(s.domain);
                    return (
                      <li key={s.domain} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="break-all font-medium text-fg">{s.domain}</div>
                          <div className="text-small text-muted">
                            {n(s.sharedKeywords)} searches in common · average position {s.avgPosition ?? "—"} · about {n(s.traffic)} visits/month
                          </div>
                        </div>
                        {saved ? (
                          <Badge tone="success">In your competitors</Badge>
                        ) : canSpend && view.canAddCompetitor ? (
                          <Button size="sm" variant="secondary" icon={<Plus />} loading={adding === s.domain} disabled={adding !== null} onClick={() => addCompetitor(s.domain)}>
                            Add to my competitors
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : live ? (
            <Button icon={<Sparkles />} loading={busy === "suggest"} disabled={busy !== null} onClick={() => run("suggest", "/suggestions", {})}>
              Suggest competitors (uses {UNITS.suggestions})
            </Button>
          ) : (
            <p className="text-small text-muted">Not checked yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------- Batch ----------

function BatchTab({ view, market, live, busy, run, rate, tz }: { view: CompetitorsView; market: string; live: boolean; busy: string | null; run: Run; rate: number; tz: string }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseDomainList(text), [text]);
  const batches = view.batches.filter((b) => b.key.endsWith(market));
  const [pick, setPick] = useState(0);
  const batch = batches[Math.min(pick, Math.max(0, batches.length - 1))];
  const over = parsed.domains.length > view.batchMax;
  const sorted = batch ? [...batch.data.rows].sort((a, b) => (b.traffic ?? -1) - (a.traffic ?? -1)) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Batch traffic check"
          description={`Paste up to ${view.batchMax} websites (one per line, or separated by commas) to get estimated Google traffic for each. Uses 1 of your Compare & batch allowance per 50 websites.`}
        />
        <CardBody className="space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={40_000} placeholder={"rivalstore.in\nanotherclinic.com\nhttps://www.example.co.in"} aria-label="Websites to check" />
          <p className={`text-small ${over ? "text-danger" : "text-muted"}`}>
            {parsed.domains.length} website{parsed.domains.length === 1 ? "" : "s"} found
            {parsed.invalid.length > 0 && ` · couldn't read: ${parsed.invalid.slice(0, 5).join(", ")}${parsed.invalid.length > 5 ? "…" : ""}`}
            {over && ` · your plan checks up to ${view.batchMax} at a time`}
          </p>
          {live && (
            <Button
              icon={<Search />}
              loading={busy === "batch"}
              disabled={parsed.domains.length === 0 || over || busy !== null}
              onClick={() => run("batch", "/batch", { text }, () => setPick(0))}
            >
              Check {parsed.domains.length || ""} website{parsed.domains.length === 1 ? "" : "s"} (uses {batchUnits(parsed.domains.length)})
            </Button>
          )}
        </CardBody>
      </Card>

      {!batch ? (
        <EmptyState bordered picture="list" title="No batch checked yet for this country." />
      ) : (
        <Card>
          <CardHeader
            title={`${batch.data.rows.length} websites`}
            description="Sorted by estimated visits. “—” means no Google data for that website."
            actions={
              <Button size="sm" variant="secondary" icon={<Download />} onClick={() => download(`traffic-batch-${batch.updatedAt.slice(0, 10)}.csv`, batchCsv(sorted, rate))}>
                CSV
              </Button>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-small text-muted">Checked {fmtDate(batch.updatedAt, true, tz)}</span>
              {batches.length > 1 && (
                <Select inputSize="sm" className="w-auto" value={String(pick)} onChange={(e) => setPick(Number(e.target.value))} aria-label="Earlier batches">
                  {batches.map((b, i) => (
                    <option key={b.key} value={i}>
                      {fmtDate(b.updatedAt, true, tz)} · {b.data.rows.length} websites
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border md:hidden">
              {sorted.map((r) => (
                <li key={r.domain} className="px-4 py-2.5">
                  <div className="break-all font-medium text-fg">{r.domain}</div>
                  <div className="text-small text-muted">
                    {n(r.traffic)} visits/mo · {n(r.keywords)} keywords · {inr(r.trafficValueUsd, rate)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table framed density="compact" maxHeight="36rem" stickyHeader caption="Batch traffic">
                <THead>
                  <tr>
                    <TH>Website</TH>
                    <TH align="right">Visits / month</TH>
                    <TH align="right">Keywords (top 100)</TH>
                    <TH align="right">Traffic value / month</TH>
                  </tr>
                </THead>
                <tbody>
                  {sorted.map((r) => (
                    <TR key={r.domain}>
                      <TD className="break-all text-fg">{r.domain}</TD>
                      <TD numeric>{n(r.traffic)}</TD>
                      <TD numeric>{n(r.keywords)}</TD>
                      <TD numeric>{inr(r.trafficValueUsd, rate)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
