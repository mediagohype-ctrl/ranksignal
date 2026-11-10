"use client";
// Keywords page body: range picker + tabs (Your keywords · By page · Tracked · Opportunities). All numbers come from
// the API routes under /api/projects/[id]/keywords (real Search Console data; never sample data).
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Search, Star } from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Notice, Select, Skeleton, Table, TabPanel, Tabs, TD, TH, THead, TR,
  buttonClass,
} from "@/components/ui";
import { OPPORTUNITY_INFO, type KeywordStat, type Opportunity, type OpportunityKind, type PageGroup, type SortKey } from "@/lib/keywords/analyze";
import { KeywordHistory } from "./keyword-history";

type TabId = "all" | "pages" | "tracked" | "opportunities";

interface Periods {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  days: number;
}

interface ListResponse {
  periods: Periods;
  totals: { siteClicks: number; siteImpressions: number; queryClicks: number; queryImpressions: number };
  hasPreviousData: boolean;
  keywordCount: number;
  list: { total: number; page: number; pages: number; pageSize: number; items: KeywordStat[] };
  starred: string[];
  stars: { used: number; limit: number };
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message ?? "Something went wrong. Please try again.");
  return j as T;
}

const n = (v: number) => v.toLocaleString("en-IN");
const pctText = (r: number | null) => (r == null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);
const posText = (p: number | null) => (p == null ? "–" : p.toFixed(1));
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function ClicksChange({ k }: { k: KeywordStat }) {
  if (!k.previous) return <Badge tone="info">New</Badge>;
  const d = k.clicksChange;
  if (d === 0) return <span className="text-muted">0</span>;
  return <span className={d > 0 ? "text-success" : "text-danger"}>{d > 0 ? `+${n(d)}` : n(d)}</span>;
}

function PositionChange({ d }: { d: number | null }) {
  if (d == null || d === 0) return <span className="text-muted">–</span>;
  // Positive = worse (moved down the page).
  const better = d < 0;
  const Icon = better ? ArrowUp : ArrowDown;
  return (
    <span className={clsx("inline-flex items-center gap-0.5", better ? "text-success" : "text-danger")}>
      <Icon aria-hidden size={13} />
      {Math.abs(d).toFixed(1)}
      <span className="sr-only">{better ? " places better" : " places worse"}</span>
    </span>
  );
}

// ---- keyword table (used by "Your keywords" and "Tracked") -------------------------------------------------------

function KeywordTable({
  projectId, days, canEdit, trackedOnly, onStarsChanged,
}: {
  projectId: string;
  days: number;
  canEdit: boolean;
  trackedOnly: boolean;
  onStarsChanged?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("clicks");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, sort, dir, days, trackedOnly]);

  const params = useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams({ days: String(days), sort, dir, page: String(page), pageSize: "50", ...extra });
      if (debounced.trim()) q.set("search", debounced.trim());
      if (trackedOnly) q.set("starred", "1");
      return q.toString();
    },
    [days, sort, dir, page, debounced, trackedOnly],
  );

  const load = useCallback(() => {
    let live = true;
    setError(null);
    getJson<ListResponse>(`/api/projects/${projectId}/keywords?${params()}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, params]);
  useEffect(() => load(), [load]);

  function sortBy(k: SortKey) {
    if (k === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir(k === "position" || k === "positionChange" || k === "query" ? "asc" : "desc");
    }
  }

  async function toggleStar(query: string, starred: boolean) {
    setBusy(query);
    setStarError(null);
    try {
      await getJson(`/api/projects/${projectId}/keywords/stars`, { method: starred ? "DELETE" : "POST", body: JSON.stringify({ query }) });
      load();
      onStarsChanged?.();
    } catch (e) {
      setStarError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const SortTH = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: "right" }) => (
    <TH align={align}>
      <button
        type="button"
        onClick={() => sortBy(k)}
        className={clsx("inline-flex items-center gap-1 uppercase hover:text-fg", sort === k && "text-fg")}
        aria-label={`Sort by ${typeof children === "string" ? children : k}`}
      >
        {children}
        {sort === k && (dir === "asc" ? <ArrowUp aria-hidden size={12} /> : <ArrowDown aria-hidden size={12} />)}
      </button>
    </TH>
  );

  const starred = new Set(data?.starred ?? []);
  const items = data?.list.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords"
            aria-label="Search keywords"
            className="pl-9"
          />
        </div>
        <a
          href={`/api/projects/${projectId}/keywords?${params({ format: "csv" })}`}
          className={buttonClass("secondary", "md")}
          download
        >
          <Download aria-hidden size={16} /> Export CSV
        </a>
        {data && (
          <span className="text-small text-muted">
            {trackedOnly
              ? `${n(data.stars.used)} of ${n(data.stars.limit)} tracked keywords used (all projects)`
              : `${n(data.list.total)} keyword${data.list.total === 1 ? "" : "s"}`}
          </span>
        )}
      </div>
      {starError && <Notice tone="warning">{starError}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
      {!data && !error && <Skeleton className="h-64 w-full" />}
      {data && items.length === 0 && (
        <EmptyState
          bordered
          size="sm"
          picture={trackedOnly ? "list" : "search"}
          title={
            trackedOnly
              ? "No tracked keywords yet."
              : debounced
                ? "No keywords match that search."
                : "No keywords in this period yet."
          }
          description={
            trackedOnly
              ? "Star a keyword on the “Your keywords” tab to watch its position here."
              : debounced
                ? undefined
                : "Search Console data appears after the first daily sync and lags 2–3 days."
          }
        />
      )}
      {data && items.length > 0 && (
        <Table framed density="compact" caption="Keywords">
          <THead>
            <tr>
              <TH className="w-8">
                <span className="sr-only">Track</span>
              </TH>
              <SortTH k="query">Keyword</SortTH>
              <SortTH k="clicks" align="right">Clicks</SortTH>
              <SortTH k="clicksChange" align="right">Change</SortTH>
              <SortTH k="impressions" align="right">Impressions</SortTH>
              <SortTH k="ctr" align="right">CTR</SortTH>
              <SortTH k="position" align="right">Avg position</SortTH>
              <SortTH k="positionChange" align="right">Moved</SortTH>
            </tr>
          </THead>
          <tbody>
            {items.map((k) => {
              const isStar = starred.has(k.query);
              const isOpen = open === k.query;
              return (
                <Fragment key={k.query}>
                  <TR>
                    <TD>
                      <button
                        type="button"
                        disabled={!canEdit || busy === k.query}
                        onClick={() => toggleStar(k.query, isStar)}
                        aria-pressed={isStar}
                        aria-label={isStar ? `Stop tracking ${k.query}` : `Track ${k.query}`}
                        title={canEdit ? (isStar ? "Stop tracking" : "Track this keyword") : "Members can track keywords"}
                        className="rounded p-1 text-muted hover:text-warning disabled:opacity-50"
                      >
                        <Star aria-hidden size={16} className={isStar ? "fill-warning text-warning" : undefined} />
                      </button>
                    </TD>
                    <TD className="max-w-[18rem]">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : k.query)}
                        aria-expanded={isOpen}
                        className="inline-flex items-start gap-1 text-left font-medium text-fg hover:underline"
                      >
                        {isOpen ? <ChevronDown aria-hidden size={14} className="mt-0.5 shrink-0" /> : <ChevronRight aria-hidden size={14} className="mt-0.5 shrink-0" />}
                        <span className="break-words">{k.query}</span>
                      </button>
                    </TD>
                    <TD numeric>{n(k.clicks)}</TD>
                    <TD numeric><ClicksChange k={k} /></TD>
                    <TD numeric>{n(k.impressions)}</TD>
                    <TD numeric>{pctText(k.ctr)}</TD>
                    <TD numeric>{posText(k.position)}</TD>
                    <TD numeric><PositionChange d={k.positionChange} /></TD>
                  </TR>
                  {isOpen && (
                    <tr className="border-b border-border bg-surface-2/40">
                      <td colSpan={8} className="px-4 py-4">
                        <KeywordHistory projectId={projectId} query={k.query} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {data && data.list.pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-small text-muted">
          <span>
            Page {data.list.page} of {data.list.pages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={data.list.page <= 1} onClick={() => setPage(data.list.page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={data.list.page >= data.list.pages} onClick={() => setPage(data.list.page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
      {data && !trackedOnly && data.totals.siteClicks > 0 && (
        <p className="text-xs text-muted">
          These keywords explain {n(data.totals.queryClicks)} of your {n(data.totals.siteClicks)} search clicks in this period. Google keeps
          rare searches private, so the rest can&apos;t be shown by keyword.
        </p>
      )}
    </div>
  );
}

// ---- by page ------------------------------------------------------------------------------------------------------

function PagesView({ projectId, days }: { projectId: string; days: number }) {
  const [data, setData] = useState<{ groups: PageGroup[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    getJson<{ groups: PageGroup[]; truncated: boolean }>(`/api/projects/${projectId}/keywords/pages?days=${days}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, days]);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!data) return <Skeleton className="h-64 w-full" />;
  if (data.groups.length === 0) return <EmptyState bordered size="sm" picture="search" title="No pages with search data in this period." />;
  return (
    <div className="space-y-3">
      <p className="text-small text-muted">
        Each page and the searches it shows up for. Asked live from Search Console{data.truncated ? " (the top 5,000 page-and-keyword pairs)" : ""}.
      </p>
      {data.groups.slice(0, 100).map((g) => {
        const isOpen = open === g.page;
        let path = g.page;
        try {
          const u = new URL(g.page);
          path = `${u.pathname}${u.search}` || "/";
        } catch {}
        return (
          <Card key={g.page}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.page)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="inline-flex min-w-0 items-center gap-1 font-medium text-fg">
                {isOpen ? <ChevronDown aria-hidden size={14} /> : <ChevronRight aria-hidden size={14} />}
                <span className="break-all">{path}</span>
              </span>
              <span className="text-small text-muted tabular-nums">
                {n(g.clicks)} clicks · {n(g.impressions)} impressions · {g.queries.length} keyword{g.queries.length === 1 ? "" : "s"}
              </span>
            </button>
            {isOpen && (
              <Table density="compact" caption={`Keywords for ${path}`}>
                <THead>
                  <tr>
                    <TH>Keyword</TH>
                    <TH align="right">Clicks</TH>
                    <TH align="right">Impressions</TH>
                    <TH align="right">CTR</TH>
                    <TH align="right">Avg position</TH>
                  </tr>
                </THead>
                <tbody>
                  {g.queries.map((q) => (
                    <TR key={q.query}>
                      <TD className="max-w-[18rem] break-words">{q.query}</TD>
                      <TD numeric>{n(q.clicks)}</TD>
                      <TD numeric>{n(q.impressions)}</TD>
                      <TD numeric>{pctText(q.ctr)}</TD>
                      <TD numeric>{posText(q.position)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---- opportunities ------------------------------------------------------------------------------------------------

const KINDS: OpportunityKind[] = ["almost_page_1", "low_ctr", "losing_ground", "new_keyword"];

function OpportunitiesView({ projectId, days }: { projectId: string; days: number }) {
  const [data, setData] = useState<{ groups: Record<OpportunityKind, Opportunity[]>; hasPreviousData: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    getJson<{ groups: Record<OpportunityKind, Opportunity[]>; hasPreviousData: boolean }>(
      `/api/projects/${projectId}/keywords/opportunities?days=${days}`,
    )
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, days]);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      {!data.hasPreviousData && (
        <Notice tone="info">
          We don&apos;t have the period before this one yet, so &quot;losing ground&quot; and &quot;new keywords&quot; will appear once there&apos;s
          more history.
        </Notice>
      )}
      {KINDS.map((kind) => {
        const list = data.groups[kind] ?? [];
        const info = OPPORTUNITY_INFO[kind];
        return (
          <Card key={kind}>
            <CardHeader title={`${info.title} (${list.length})`} description={info.blurb} />
            <CardBody>
              {list.length === 0 ? (
                <p className="text-small text-muted">Nothing here for this period.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((o) => (
                    <li key={o.query} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="break-words font-medium text-fg">{o.query}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {n(o.stat.clicks)} clicks · {n(o.stat.impressions)} impressions · position {posText(o.stat.position)}
                        </span>
                      </div>
                      <p className="mt-1 text-small text-muted">{o.why}</p>
                      <p className="mt-1 text-small text-fg-soft">
                        <span className="font-medium text-fg">Next step: </span>
                        {o.nextStep}
                      </p>
                      {o.link && (
                        <Link href={o.link.href} className="mt-1 inline-block text-small font-medium text-primary hover:underline">
                          {o.link.label} →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        );
      })}
      <p className="text-xs text-muted">
        &quot;New&quot; means the search wasn&apos;t in our stored data for the previous period — that can also mean it was too rare for Google to
        report then. Click-rate expectations are rough industry averages, not a promise.
      </p>
    </div>
  );
}

// ---- shell --------------------------------------------------------------------------------------------------------

export function KeywordsExplorer({
  projectId, canEdit, lastDataDate, queriesPerDayCap, starLimit,
}: {
  projectId: string;
  canEdit: boolean;
  lastDataDate: string | null;
  queriesPerDayCap: number;
  starLimit: number;
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [days, setDays] = useState(28);
  const [starsVersion, setStarsVersion] = useState(0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Keyword views"
          idPrefix="kw"
          value={tab}
          onChange={(v) => setTab(v as TabId)}
          tabs={[
            { id: "all", label: "Your keywords" },
            { id: "pages", label: "By page" },
            { id: "tracked", label: "Tracked" },
            { id: "opportunities", label: "Opportunities" },
          ]}
        />
        <label className="flex items-center gap-2 text-small text-muted">
          Period
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} inputSize="sm" className="w-36">
            <option value="7">Last 7 days</option>
            <option value="28">Last 28 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        </label>
      </div>
      {lastDataDate && (
        <p className="text-xs text-muted">
          Up to {fmtDay(lastDataDate)} (Search Console data arrives 2–3 days late), compared with the {days} days before. Positions are
          Google&apos;s averages for your own site across all searchers, devices and locations — not a single live ranking.
          We store up to {n(queriesPerDayCap)} keywords per day.
        </p>
      )}
      <TabPanel idPrefix="kw" value={tab}>
        {tab === "all" && (
          <KeywordTable projectId={projectId} days={days} canEdit={canEdit} trackedOnly={false} onStarsChanged={() => setStarsVersion((v) => v + 1)} />
        )}
        {tab === "pages" && <PagesView projectId={projectId} days={days} />}
        {tab === "tracked" && (
          <div className="space-y-3">
            <p className="text-small text-muted">
              Star up to {n(starLimit)} keywords on your plan to watch them here. Click a keyword to see its position and clicks over time.
            </p>
            <KeywordTable key={starsVersion} projectId={projectId} days={days} canEdit={canEdit} trackedOnly />
          </div>
        )}
        {tab === "opportunities" && <OpportunitiesView projectId={projectId} days={days} />}
      </TabPanel>
    </div>
  );
}
