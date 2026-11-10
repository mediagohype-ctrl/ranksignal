"use client";
// Backlink checker + link gap. Everything shown comes from stored snapshots (viewing never re-bills); only "Refresh"
// and "Find sites" make paid DataForSEO calls. Tables become stacked cards at phone width.
import { useMemo, useState } from "react";
import { Download, ExternalLink, Link2, RefreshCw, Search, Target } from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Meter, Notice, Stat, Table, TabPanel, Tabs, TD, TH, THead, TR,
} from "@/components/ui";
import { TrendChart } from "@/components/app/charts";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import { anchorsCsv, backlinksCsv, linkGapCsv, referringDomainsCsv } from "@/lib/backlinks/csv";
import { LINK_GAP_MAX_COMPETITORS, frequencyLabel } from "@/lib/backlinks/limits";
import type { AnchorRow, Backlink, LinkGapItem, ReferringDomain } from "@/lib/backlinks/parse";
import type { BacklinksView } from "@/lib/backlinks/service";

type TabId = "overview" | "domains" | "links" | "anchors" | "changes" | "gap";

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-IN"));

function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shortUrl(u: string | null): string {
  if (!u) return "—";
  try {
    const x = new URL(u);
    const s = `${x.hostname.replace(/^www\./, "")}${x.pathname === "/" ? "" : x.pathname}`;
    return s.length > 70 ? `${s.slice(0, 69)}…` : s;
  } catch {
    return u.slice(0, 70);
  }
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-fg underline-offset-2 hover:underline">
      {children}
      <ExternalLink size={11} aria-hidden className="shrink-0 text-muted" />
    </a>
  );
}

function Strength({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  const tone = value >= 50 ? "success" : value >= 20 ? "primary" : "neutral";
  return <Badge tone={tone}>{value}</Badge>;
}

function FollowBadge({ dofollow }: { dofollow: boolean | null }) {
  if (dofollow === null) return <span className="text-muted">—</span>;
  return dofollow ? <Badge tone="success">Followed</Badge> : <Badge tone="neutral">Nofollow</Badge>;
}

// ---- responsive list: cards on phones, a table from md up --------------------------------------------------------

interface Column<T> {
  label: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

function ResponsiveList<T>({ rows, columns, keyOf, caption }: { rows: T[]; columns: Column<T>[]; keyOf: (r: T, i: number) => string; caption: string }) {
  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((r, i) => (
          <li key={keyOf(r, i)} className="space-y-1.5 rounded-xl border border-border bg-surface p-4">
            <div className="font-medium text-fg">{columns[0].cell(r)}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
              {columns.slice(1).map((c) => (
                <div key={c.label} className="contents">
                  <dt className="text-muted">{c.label}</dt>
                  <dd className="min-w-0 break-words text-fg">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table framed caption={caption}>
          <THead>
            <tr>
              {columns.map((c) => (
                <TH key={c.label}>{c.label}</TH>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((r, i) => (
              <TR key={keyOf(r, i)}>
                {columns.map((c) => (
                  <TD key={c.label} className={c.className}>
                    {c.cell(r)}
                  </TD>
                ))}
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function ListToolbar({ q, setQ, placeholder, onCsv, count, total, noun }: {
  q: string; setQ: (v: string) => void; placeholder: string; onCsv: () => void; count: number; total: number | null; noun: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
        </div>
        <Button variant="outline" icon={<Download />} onClick={onCsv} disabled={!count}>
          Download CSV
        </Button>
      </div>
      <p className="text-small text-muted" aria-live="polite">
        Showing {n(count)} {noun}
        {total !== null && total > count ? ` (the top ${n(count)} of ${n(total)} we know about)` : ""}.
      </p>
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  referringDomains: "linking sites",
  backlinks: "links",
  anchors: "anchor text",
  newLost: "new & lost",
};

// ---- main ---------------------------------------------------------------------------------------------------------

export function BacklinksExplorer({ projectId, initial, canRefresh }: { projectId: string; initial: BacklinksView; canRefresh: boolean }) {
  const [view, setView] = useState(initial);
  const [tab, setTab] = useState<TabId>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = view.latest?.data ?? null;
  const ready = view.availability.enabled;
  const a = view.allowance;
  const tooSoon = view.monitor.canRefreshAt !== null && new Date(view.monitor.canRefreshAt).getTime() > Date.now();

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ item: BacklinksView }>(`/api/projects/${projectId}/backlinks/refresh`, { method: "POST", body: {} });
      setView(r.item);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const usageLine =
    a.limit === 0
      ? "Backlink refreshes aren't included in your plan."
      : `${n(a.used)} of ${n(a.limit)} backlink lookups used this month · each refresh uses ${a.unitsPerRefresh} · ${a.refreshesLeft} refresh${a.refreshesLeft === 1 ? "" : "es"} left`;

  const refreshButton = canRefresh && ready && (
    <Button
      icon={<RefreshCw />}
      loading={busy}
      onClick={refresh}
      disabled={busy || tooSoon || a.refreshesLeft < 1}
      title={tooSoon ? `You can refresh again after ${fmtDate(view.monitor.canRefreshAt, true)}` : undefined}
    >
      {data ? "Refresh" : "Check my backlinks"}
    </Button>
  );

  const toolbar = (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-small">
          <div className="font-medium text-fg">
            {view.target ?? "Your website"}
            {view.latest && <span className="font-normal text-muted"> · Updated {fmtDate(view.latest.takenAt, true)}</span>}
          </div>
          <div className="text-muted">{usageLine}</div>
          <div className="text-muted">
            {frequencyLabel(view.monitor.refreshDays)}
            {view.monitor.nextAutoRefreshAt && view.monitor.refreshDays !== null ? ` · next around ${fmtDate(view.monitor.nextAutoRefreshAt)}` : ""}
            {tooSoon ? ` · you can refresh again after ${fmtDate(view.monitor.canRefreshAt, true)}` : ""}
          </div>
        </div>
        {refreshButton}
      </CardBody>
    </Card>
  );

  if (!ready && !data) {
    return (
      <EmptyState
        bordered
        picture="search"
        title={view.availability.configured ? "Backlink data isn't switched on for our account yet." : "Backlink data isn't switched on yet."}
        description={view.availability.configured ? "It needs one more switch on our side. Nothing is needed from you — check back soon." : (view.availability.message ?? undefined)}
      />
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "domains", label: "Linking sites", count: data?.referringDomains.length },
    { id: "links", label: "Links", count: data?.backlinks.length },
    { id: "anchors", label: "Anchor text", count: data?.anchors.length },
    { id: "changes", label: "New & lost" },
    { id: "gap", label: "Link gap" },
  ];

  return (
    <div className="space-y-5">
      {toolbar}
      {!ready && <Notice tone="warning">{view.availability.message} The numbers below are from the last refresh.</Notice>}
      {view.monitor.lastError && <Notice tone="warning">{view.monitor.lastError}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {!data ? (
        <EmptyState
          bordered
          picture="search"
          title="See who links to your website."
          description={
            canRefresh
              ? `We'll look up your backlinks, the sites they come from and the words they use. This uses ${a.unitsPerRefresh} of your ${n(a.limit)} monthly backlink lookups.`
              : "Ask a team member with edit access to run the first backlink check."
          }
          action={refreshButton || undefined}
        />
      ) : (
        <div>
          <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as TabId)} label="Backlink views" idPrefix="bl" />
          <TabPanel idPrefix="bl" value={tab}>
            {data.sectionErrors.length > 0 && tab !== "gap" && (
              <Notice tone="warning" className="mb-4">
                Part of the last refresh didn&apos;t load ({data.sectionErrors.map((s) => SECTION_LABEL[s] ?? s).join(", ")}). It will be filled in on the next refresh.
              </Notice>
            )}
            {tab === "overview" && <Overview view={view} />}
            {tab === "domains" && <DomainsTab rows={data.referringDomains} total={data.referringDomainsTotal} host={view.target} />}
            {tab === "links" && <LinksTab rows={data.backlinks} total={data.backlinksTotal} host={view.target} />}
            {tab === "anchors" && <AnchorsTab rows={data.anchors} total={data.anchorsTotal} host={view.target} />}
            {tab === "changes" && <ChangesTab view={view} />}
            {tab === "gap" && <LinkGapTab projectId={projectId} view={view} setView={setView} canRun={canRefresh && ready} />}
          </TabPanel>
        </div>
      )}
      {!data && (ready || view.linkGap.reports.length > 0) && <LinkGapTab projectId={projectId} view={view} setView={setView} canRun={canRefresh && ready} />}
    </div>
  );
}

// ---- tabs ---------------------------------------------------------------------------------------------------------

function Overview({ view }: { view: BacklinksView }) {
  const s = view.latest?.data.summary ?? null;
  const points = view.history.filter((h) => h.referringDomains !== null);
  const max = Math.max(10, ...points.map((p) => p.referringDomains ?? 0));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Backlinks" value={n(s?.backlinks)} hint="Links from other websites to yours." />
        <Stat label="Linking sites" value={n(s?.referringDomains)} hint="Different websites that link to you. This matters more than the link count." />
        <Stat label="Site strength" value={s?.rank ?? "—"} hint="0–100, from DataForSEO. Higher means more and stronger links." />
        <Stat label="Broken backlinks" value={n(s?.brokenBacklinks)} hint="Links pointing to pages on your site that don't open. Fix or redirect those pages." />
      </div>
      {s && s.backlinks !== null && s.dofollow !== null && (
        <Card>
          <CardHeader title="Followed vs nofollow links" />
          <CardBody className="space-y-3">
            <Meter value={s.dofollow} max={Math.max(1, s.backlinks)} label="Followed links" tone="primary" size="md" />
            <p className="text-small text-muted">
              <strong className="text-fg">{n(s.dofollow)} followed</strong> and <strong className="text-fg">{n(s.nofollow)} nofollow</strong>. A
              followed link passes on trust (like a recommendation). A &ldquo;nofollow&rdquo; link tells Google not to count it — it can still
              bring visitors. A mix of both is normal.
            </p>
          </CardBody>
        </Card>
      )}
      {points.length >= 2 && (
        <Card>
          <CardHeader title="Linking sites over time" />
          <CardBody>
            <TrendChart
              name="Linking sites"
              domain={[0, Math.ceil(max * 1.1)]}
              format={(v) => Math.round(v).toLocaleString("en-IN")}
              data={points.map((p) => ({ label: fmtDate(p.takenAt), value: p.referringDomains ?? 0 }))}
            />
          </CardBody>
        </Card>
      )}
      <Notice tone="neutral" title="What is a backlink?">
        A backlink is a link from another website to yours. Google treats it like a recommendation: links from trusted sites in your field or
        city help you rank. A few good links beat many weak ones. Never buy links — Google can penalise that.
      </Notice>
    </div>
  );
}

function useFiltered<T>(rows: T[], q: string, text: (r: T) => string) {
  return useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => text(r).toLowerCase().includes(needle)) : rows;
  }, [rows, q, text]);
}

const domainText = (r: ReferringDomain) => r.domain;
function DomainsTab({ rows, total, host }: { rows: ReferringDomain[]; total: number | null; host: string | null }) {
  const [q, setQ] = useState("");
  const shown = useFiltered(rows, q, domainText);
  if (!rows.length) return <EmptyState size="sm" bordered picture="list" title="We didn't find any websites linking to you yet." />;
  return (
    <div className="space-y-3">
      <p className="text-small text-muted">Websites that link to you, strongest first. One link from a strong, relevant site is worth more than many from weak ones.</p>
      <ListToolbar q={q} setQ={setQ} placeholder="Search linking sites" count={shown.length} total={total} noun="linking sites" onCsv={() => downloadCsv(`linking-sites-${host ?? "site"}.csv`, referringDomainsCsv(shown))} />
      <ResponsiveList
        caption="Websites linking to you"
        rows={shown}
        keyOf={(r) => r.domain}
        columns={[
          { label: "Website", cell: (r) => <ExtLink href={`https://${r.domain}`}>{r.domain}</ExtLink> },
          { label: "Strength", cell: (r) => <Strength value={r.rank} /> },
          { label: "Links to you", cell: (r) => n(r.backlinks), className: "tabular-nums" },
          { label: "Followed", cell: (r) => n(r.dofollow), className: "tabular-nums" },
          { label: "First seen", cell: (r) => fmtDate(r.firstSeen), className: "whitespace-nowrap" },
        ]}
      />
    </div>
  );
}

const linkText = (r: Backlink) => `${r.urlFrom} ${r.anchor ?? ""} ${r.urlTo ?? ""} ${r.pageTitle ?? ""}`;
function LinksTab({ rows, total, host }: { rows: Backlink[]; total: number | null; host: string | null }) {
  const [q, setQ] = useState("");
  const shown = useFiltered(rows, q, linkText);
  if (!rows.length) return <EmptyState size="sm" bordered picture="list" title="We didn't find any links to your website yet." />;
  return (
    <div className="space-y-3">
      <p className="text-small text-muted">The best link from each website (one per site), strongest site first.</p>
      <ListToolbar q={q} setQ={setQ} placeholder="Search pages or link words" count={shown.length} total={total} noun="links" onCsv={() => downloadCsv(`backlinks-${host ?? "site"}.csv`, backlinksCsv(shown))} />
      <ResponsiveList
        caption="Links to your website"
        rows={shown}
        keyOf={(r, i) => `${r.urlFrom}-${i}`}
        columns={[
          {
            label: "Linking page",
            className: "min-w-56 max-w-sm",
            cell: (r) => (
              <span className="block">
                {r.pageTitle && <span className="block text-small font-medium text-fg">{r.pageTitle}</span>}
                <ExtLink href={r.urlFrom}>{shortUrl(r.urlFrom)}</ExtLink>
              </span>
            ),
          },
          { label: "Link words", className: "min-w-32 max-w-xs", cell: (r) => (r.anchor ? `“${r.anchor}”` : <span className="text-muted">(no words, e.g. an image)</span>) },
          { label: "Points to", className: "min-w-40 max-w-xs", cell: (r) => (r.urlTo ? <ExtLink href={r.urlTo}>{shortUrl(r.urlTo)}</ExtLink> : "—") },
          { label: "Type", cell: (r) => <span className="flex flex-wrap gap-1"><FollowBadge dofollow={r.dofollow} />{r.isBroken && <Badge tone="danger">Broken</Badge>}</span> },
          { label: "Site strength", cell: (r) => <Strength value={r.domainRank} /> },
          { label: "First seen", cell: (r) => fmtDate(r.firstSeen), className: "whitespace-nowrap" },
        ]}
      />
    </div>
  );
}

const anchorText = (r: AnchorRow) => r.anchor ?? "";
function AnchorsTab({ rows, total, host }: { rows: AnchorRow[]; total: number | null; host: string | null }) {
  const [q, setQ] = useState("");
  const shown = useFiltered(rows, q, anchorText);
  const totalLinks = rows.reduce((s, r) => s + (r.backlinks ?? 0), 0);
  if (!rows.length) return <EmptyState size="sm" bordered picture="list" title="No anchor text yet." />;
  return (
    <div className="space-y-3">
      <p className="text-small text-muted">
        Anchor text is the clickable words of a link. A natural mix has your business name, your web address and a few topic words. Lots of
        identical keyword-stuffed anchors can look paid-for to Google.
      </p>
      <ListToolbar q={q} setQ={setQ} placeholder="Search link words" count={shown.length} total={total} noun="different link words" onCsv={() => downloadCsv(`anchor-text-${host ?? "site"}.csv`, anchorsCsv(shown))} />
      <ResponsiveList
        caption="Anchor text"
        rows={shown}
        keyOf={(r, i) => `${r.anchor ?? "-"}-${i}`}
        columns={[
          { label: "Link words", className: "min-w-48 max-w-sm", cell: (r) => (r.anchor ? `“${r.anchor}”` : <span className="text-muted">(no words, e.g. an image)</span>) },
          { label: "Linking sites", cell: (r) => n(r.referringDomains), className: "tabular-nums" },
          { label: "Links", cell: (r) => n(r.backlinks), className: "tabular-nums" },
          {
            label: "Share of links",
            className: "min-w-32",
            cell: (r) =>
              totalLinks > 0 && r.backlinks !== null ? (
                <span className="flex items-center gap-2">
                  <Meter value={r.backlinks} max={totalLinks} label={`Share of links for ${r.anchor ?? "no words"}`} tone="primary" size="xs" className="w-20" />
                  <span className="tabular-nums">{Math.round((r.backlinks / totalLinks) * 100)}%</span>
                </span>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}

function ChangesTab({ view }: { view: BacklinksView }) {
  const c = view.changes;
  const weeks = view.latest?.data.newLost ?? [];
  const recent = weeks.slice(-12).reverse();
  return (
    <div className="space-y-5">
      {c ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={`New linking sites (${c.gained.length})`}
              description={c.comparedWith ? `Not in your list on ${fmtDate(c.comparedWith)}.` : "First linked to you in the last 30 days."}
            />
            <CardBody>
              {c.gained.length ? (
                <ul className="divide-y divide-border">
                  {c.gained.slice(0, 50).map((d) => (
                    <li key={d.domain} className="flex items-center justify-between gap-3 py-2 text-small">
                      <ExtLink href={`https://${d.domain}`}>{d.domain}</ExtLink>
                      <Strength value={d.rank} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted">No new linking sites.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={`Gone from your list (${c.gone.length})`}
              description="Were in your top linking sites last time but not now: the link may have been removed, or other sites moved ahead."
            />
            <CardBody>
              {!c.comparedWith ? (
                <p className="text-small text-muted">We&apos;ll compare after your next refresh.</p>
              ) : c.gone.length ? (
                <ul className="divide-y divide-border">
                  {c.gone.slice(0, 50).map((d) => (
                    <li key={d.domain} className="flex items-center justify-between gap-3 py-2 text-small">
                      <ExtLink href={`https://${d.domain}`}>{d.domain}</ExtLink>
                      <Strength value={d.rank} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted">None — every site is still there.</p>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <EmptyState size="sm" bordered picture="chart" title="We'll show changes once your linking sites have loaded." />
      )}
      {recent.length > 0 && (
        <Card>
          <CardHeader title="Week by week" description="New and lost links across the whole web, as DataForSEO saw them." />
          <CardBody>
            <ResponsiveList
              caption="New and lost links per week"
              rows={recent}
              keyOf={(r) => r.date}
              columns={[
                { label: "Week of", cell: (r) => fmtDate(r.date), className: "whitespace-nowrap" },
                { label: "New sites", cell: (r) => n(r.newDomains), className: "tabular-nums text-success" },
                { label: "Lost sites", cell: (r) => n(r.lostDomains), className: "tabular-nums text-danger" },
                { label: "New links", cell: (r) => n(r.newBacklinks), className: "tabular-nums" },
                { label: "Lost links", cell: (r) => n(r.lostBacklinks), className: "tabular-nums" },
              ]}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function LinkGapTab({ projectId, view, setView, canRun }: { projectId: string; view: BacklinksView; setView: (v: BacklinksView) => void; canRun: boolean }) {
  const saved = view.linkGap.savedCompetitors;
  const [picked, setPicked] = useState<string[]>(saved.slice(0, LINK_GAP_MAX_COMPETITORS));
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(view.linkGap.reports[0]?.id ?? null);
  const report = view.linkGap.reports.find((r) => r.id === reportId) ?? view.linkGap.reports[0] ?? null;
  const ga = view.linkGap.allowance;
  const typedList = typed.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const all = [...new Set([...picked, ...typedList])];
  const tooMany = all.length > LINK_GAP_MAX_COMPETITORS;

  function toggle(d: string) {
    setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ reportId: string; item: BacklinksView }>(`/api/projects/${projectId}/backlinks/link-gap`, { body: { competitors: all } });
      setView(r.item);
      setReportId(r.reportId);
      setTyped("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={<Target />}
          title="Sites that might link to you too"
          description="Websites that link to your competitors but not to you. If they linked to a competitor, they may link to you as well — for example a local directory, a supplier or a news site."
        />
        <CardBody>
          {canRun ? (
            <form onSubmit={run} className="space-y-3">
              {saved.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-small font-medium text-fg">Your saved competitors</legend>
                  <div className="flex flex-wrap gap-2">
                    {saved.map((d) => (
                      <label key={d} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-small">
                        <input type="checkbox" checked={picked.includes(d)} onChange={() => toggle(d)} />
                        {d}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div>
                <label htmlFor="gap-typed" className="mb-1 block text-small font-medium text-fg">
                  {saved.length ? "Or type other competitor websites" : "Competitor websites"}
                </label>
                <Input id="gap-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. rivalclinic.in, another.com" maxLength={600} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-small text-muted">
                  Up to {LINK_GAP_MAX_COMPETITORS} competitors per search · {n(ga.used)} of {n(ga.limit)} link-gap searches used this month
                </p>
                <Button type="submit" icon={<Search />} loading={busy} disabled={busy || all.length === 0 || tooMany || ga.remaining < 1}>
                  Find sites
                </Button>
              </div>
              {tooMany && <Notice tone="warning">Pick at most {LINK_GAP_MAX_COMPETITORS} competitors.</Notice>}
              {ga.limit === 0 && <Notice tone="neutral">Link gap isn&apos;t included in your plan. Upgrade to use it.</Notice>}
            </form>
          ) : (
            <p className="text-small text-muted">
              {view.availability.enabled ? "Ask a team member with edit access to run a link-gap search." : view.availability.message}
            </p>
          )}
          {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
        </CardBody>
      </Card>

      {report && <LinkGapResults report={report} reports={view.linkGap.reports} onPick={setReportId} />}
    </div>
  );
}

const gapText = (r: LinkGapItem) => `${r.domain} ${r.linksTo.join(" ")}`;
function LinkGapResults({ report, reports, onPick }: { report: BacklinksView["linkGap"]["reports"][number]; reports: BacklinksView["linkGap"]["reports"]; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const shown = useFiltered(report.items, q, gapText);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-h3 text-fg">
          Linking to {report.competitors.join(", ")} but not {report.target}
        </h3>
        {reports.length > 1 && (
          <select
            aria-label="Earlier searches"
            value={report.id}
            onChange={(e) => onPick(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-small"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {fmtDate(r.createdAt)} · {r.competitors.join(", ")}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-small text-muted">Searched {fmtDate(report.createdAt, true)}. Sites linking to more of your competitors come first — they are the most likely to link to you.</p>
      {report.items.length === 0 ? (
        <EmptyState size="sm" bordered picture="done" title="No gaps found: every site we know that links to these competitors also links to you, or they have few links." />
      ) : (
        <>
          <ListToolbar q={q} setQ={setQ} placeholder="Search sites" count={shown.length} total={report.totalCount} noun="sites" onCsv={() => downloadCsv(`link-gap-${report.target}.csv`, linkGapCsv(shown))} />
          <ResponsiveList
            caption="Sites linking to competitors but not to you"
            rows={shown}
            keyOf={(r) => r.domain}
            columns={[
              { label: "Website", cell: (r) => <ExtLink href={`https://${r.domain}`}>{r.domain}</ExtLink> },
              { label: "Strength", cell: (r) => <Strength value={r.rank} /> },
              {
                label: "Links to",
                cell: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.linksTo.map((c) => (
                      <Badge key={c} tone="neutral">
                        <Link2 size={11} aria-hidden className="mr-1 inline" />
                        {c}
                      </Badge>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

