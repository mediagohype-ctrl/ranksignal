"use client";
// Rank tracker: add keywords (location + device), see where the website ranks on Google, how it moved, who is above,
// and a position chart per keyword. Data: stored DataForSEO checks only (viewing never makes a paid call).
import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, LineChart as LineChartIcon, Minus, Plus, RefreshCw, Star, Trash2,
} from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, LinkButton, Meter, Notice, Select, Stat, Table, TD, TH, THead, TR, Textarea,
} from "@/components/ui";
import type { RankRow, RankTrackerView } from "@/lib/rank-tracker/service";
import { RankHistoryChart } from "./rank-history-chart";

export interface LocationOption {
  id: string;
  label: string;
}

const FEATURE_LABELS: Record<string, string> = {
  ai_overview: "AI Overview",
  featured_snippet: "Featured snippet",
  answer_box: "Answer box",
  local_pack: "Map pack",
  map: "Map",
  people_also_ask: "People also ask",
  knowledge_graph: "Knowledge panel",
  top_stories: "Top stories",
  video: "Videos",
  short_videos: "Short videos",
  images: "Images",
  shopping: "Shopping",
  popular_products: "Popular products",
  discussions_and_forums: "Forums",
  perspectives: "Perspectives",
  hotels_pack: "Hotels",
  jobs: "Jobs",
  events: "Events",
};
const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f.replace(/_/g, " ");

const PAGE = 100;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = typeof j?.error === "object" ? j?.error?.message : j?.message;
    throw new Error(msg ?? "Something went wrong. Please try again.");
  }
  return j as T;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

function Change({ row }: { row: RankRow }) {
  const c = row.change;
  if (!row.checked) return <span className="text-muted">Not checked yet</span>;
  if (c === null) return <span className="text-muted">First check</span>;
  if (c === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <Minus aria-hidden size={14} /> No change
      </span>
    );
  }
  if (c > 0) {
    const entered = row.position !== null && row.position + c === 101;
    return (
      <span className="inline-flex items-center gap-1 font-medium text-success">
        <ArrowUp aria-hidden size={14} /> {entered ? "New in top 100" : `Up ${c}`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-danger">
      <ArrowDown aria-hidden size={14} /> {row.position === null ? "Dropped out of top 100" : `Down ${-c}`}
    </span>
  );
}

function Position({ row }: { row: RankRow }) {
  if (!row.checked) return <span className="text-muted">—</span>;
  if (row.position === null) return <span className="text-muted">Not in top 100</span>;
  return <span className="font-semibold tabular-nums text-fg">#{row.position}</span>;
}

function Features({ list }: { list: string[] }) {
  if (list.length === 0) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((f) => (
        <Badge key={f} tone={f === "ai_overview" ? "accent" : "neutral"}>
          {featureLabel(f)}
        </Badge>
      ))}
    </div>
  );
}

function Above({ row }: { row: RankRow }) {
  if (row.competitors.length === 0) return <span className="text-muted">{row.position === 1 ? "Nobody — you're first" : "—"}</span>;
  return (
    <ul className="space-y-0.5">
      {row.competitors.map((c) => (
        <li key={c.domain} className="whitespace-nowrap">
          <span className="tabular-nums text-muted">#{c.position}</span> {c.domain}
        </li>
      ))}
    </ul>
  );
}

function RankingUrl({ url }: { url: string | null }) {
  if (!url) return <span className="text-muted">—</span>;
  let label = url;
  try {
    const u = new URL(url);
    label = `${u.pathname}${u.search}` || "/";
  } catch {
    /* keep raw */
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline" title={url}>
      {label}
    </a>
  );
}

export function RankTracker({
  projectId, initial, canEdit, locations,
}: {
  projectId: string;
  initial: RankTrackerView;
  canEdit: boolean;
  locations: LocationOption[];
}) {
  const [view, setView] = useState(initial);
  const [text, setText] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "in");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);

  const s = view.summary;
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? view.rows.filter((r) => r.keyword.includes(f)) : view.rows;
  }, [view.rows, filter]);
  const used = view.rows.length;
  const base = `/api/projects/${projectId}/rankings`;

  async function reload() {
    const r = await api<{ item: RankTrackerView }>(base);
    setView(r.item);
  }

  async function add(keywords: string[], tag: string) {
    setBusy(tag);
    setMessage(null);
    try {
      const r = await api<{ added: number; skipped: number; limit: number; note: string | null; invalid: number }>(base, {
        method: "POST",
        body: JSON.stringify({ keywords, locationId, device, language }),
      });
      const parts = [r.added ? `Now tracking ${r.added} new keyword${r.added === 1 ? "" : "s"}. The first check runs within a few minutes.` : "No new keywords added."];
      if (r.note) parts.push(r.note);
      if (r.invalid) parts.push(`${r.invalid} line${r.invalid === 1 ? " was" : "s were"} too long (80 characters max).`);
      setMessage({ tone: r.added ? "success" : "info", text: parts.join(" ") });
      if (r.added && tag === "add") setText("");
      await reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: RankRow) {
    if (!window.confirm(`Stop tracking “${row.keyword}” (${row.locationLabel}, ${row.device})? Its history will be deleted.`)) return;
    setBusy(`rm:${row.id}`);
    setMessage(null);
    try {
      await api(base, { method: "DELETE", body: JSON.stringify({ ids: [row.id] }) });
      await reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function checkNow() {
    setBusy("check");
    setMessage(null);
    try {
      const r = await api<{ queued: number }>(`${base}/check`, { method: "POST" });
      setMessage({ tone: "success", text: `Checking ${r.queued} keyword${r.queued === 1 ? "" : "s"} on Google now. Results appear here in a few minutes — refresh the page to see them.` });
      await reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const textLines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const paused = view.state.status === "paused_allowance";
  const allowanceLeft = view.allowance.remaining;
  const checkDisabledReason = !view.configured
    ? "Live Google data isn't switched on yet."
    : used === 0
      ? "Add a keyword first."
      : view.state.nextManualAt
        ? `Available again ${fmtWhen(view.state.nextManualAt)}.`
        : allowanceLeft < 1
          ? "This month's checks are used up."
          : null;

  return (
    <div className="space-y-6">
      {!view.configured && <Notice tone="warning">Live Google data isn&apos;t switched on yet, so checks are paused. Your keywords and past results are kept.</Notice>}
      {paused && view.state.message && <Notice tone="warning" title="Rank checks paused">{view.state.message}</Notice>}
      {view.state.running && <Notice tone="info">Checking your keywords on Google right now. Refresh the page in a few minutes to see the new positions.</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Card>
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 text-small text-muted">
            <p>
              Checked <strong className="text-fg">{view.frequency}</strong> on your plan for {view.domain ?? "your website"} · last run {fmtWhen(view.state.lastRunAt)}
            </p>
            <div className="max-w-sm">
              <Meter value={view.allowance.used} max={Math.max(1, view.allowance.limit)} label="Keyword checks used this month" showValue />
              <p className="mt-1 text-xs">
                {view.allowance.used.toLocaleString("en-IN")} of {view.allowance.limit.toLocaleString("en-IN")} keyword checks used this month (one check = one keyword looked up on Google once).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button icon={<RefreshCw />} variant="secondary" loading={busy === "check"} disabled={busy !== null || checkDisabledReason !== null} onClick={checkNow} title={checkDisabledReason ?? "Check every keyword now (once a day)"}>
                Check now
              </Button>
            )}
            {used > 0 && (
              <LinkButton href={`${base}?format=csv`} variant="outline" icon={<Download />}>
                Export CSV
              </LinkButton>
            )}
          </div>
        </CardBody>
        {canEdit && checkDisabledReason && used > 0 && view.configured && (
          <p className="px-5 pb-4 text-xs text-muted">“Check now”: {checkDisabledReason}</p>
        )}
      </Card>

      {used > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat size="sm" label="Average position" value={s.averagePosition ?? "—"} hint="Of keywords in the top 100" />
          <Stat size="sm" label="In top 3" value={s.top3} hint={`of ${s.tracked} keywords`} />
          <Stat size="sm" label="In top 10" value={s.top10} hint="Page 1 of Google" />
          <Stat size="sm" label="Not ranking" value={s.notRanking} hint="Not in the top 100" />
          <Stat size="sm" label="Moved up" value={s.movedUp} hint="vs a week ago" />
          <Stat size="sm" label="Moved down" value={s.movedDown} hint="vs a week ago" />
        </div>
      )}

      {canEdit && (
        <Card>
          <CardHeader title="Track keywords" description={`${used.toLocaleString("en-IN")} of ${view.limit.toLocaleString("en-IN")} keywords tracked for this website. Type the searches your customers use, one per line.`} />
          <CardBody>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void add(text.split(/\r?\n/), "add");
              }}
            >
              <Field label="Keywords (one per line)" htmlFor="rt-keywords">
                <Textarea
                  id="rt-keywords"
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"dentist in pune\nbest root canal treatment pune"}
                  maxLength={20_000}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Location" htmlFor="rt-location">
                  <Select id="rt-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Device" htmlFor="rt-device">
                  <Select id="rt-device" value={device} onChange={(e) => setDevice(e.target.value === "desktop" ? "desktop" : "mobile")}>
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                  </Select>
                </Field>
                <Field label="Search language" htmlFor="rt-language">
                  <Select id="rt-language" value={language} onChange={(e) => setLanguage(e.target.value === "hi" ? "hi" : "en")}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </Select>
                </Field>
              </div>
              <Button type="submit" icon={<Plus />} loading={busy === "add"} disabled={busy !== null || textLines === 0}>
                Track {textLines > 1 ? `${textLines} keywords` : "keyword"}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {canEdit && view.starred.length > 0 && (
        <Card>
          <CardHeader
            title="Add from Search Console"
            description="Keywords you starred on the Keywords page. Track them to see your exact Google position by city and device."
            actions={
              <Button size="sm" variant="secondary" icon={<Star />} loading={busy === "starred"} disabled={busy !== null} onClick={() => add(view.starred, "starred")}>
                Track all {view.starred.length}
              </Button>
            }
          />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {view.starred.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => add([q], `star:${q}`)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-small text-fg-soft hover:bg-surface-2 disabled:opacity-60"
                  aria-label={`Track ${q}`}
                >
                  <Plus aria-hidden size={12} /> {q}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Uses the location and device chosen above.</p>
          </CardBody>
        </Card>
      )}

      {used === 0 ? (
        <EmptyState
          bordered
          picture="chart"
          title="No keywords tracked yet."
          description={
            canEdit
              ? "Add the searches you want to show up for. We'll check your Google position for each one and show how it changes."
              : "Ask a Member, Admin or Owner of this workspace to add keywords to track."
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Your positions on Google"
            description="Position 1 is the top result. “Not in top 100” means Google didn't show your website in the first 100 results."
            actions={
              <Input
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Filter keywords"
                aria-label="Filter keywords"
                inputSize="sm"
                className="w-48"
              />
            }
          />
          {/* Wide screens: table. */}
          <div className="hidden md:block">
            <Table caption="Tracked keywords and their Google positions">
              <THead>
                <tr>
                  <TH>Keyword</TH>
                  <TH align="right">Position</TH>
                  <TH>Change</TH>
                  <TH align="right">Best</TH>
                  <TH>Ranking page</TH>
                  <TH>On the results page</TH>
                  <TH>Who&apos;s above you</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <tbody>
                {rows.slice(0, shown).map((r) => (
                  <Fragment key={r.id}>
                    <TR>
                      <TD>
                        <button
                          type="button"
                          className="flex items-start gap-1 text-left font-medium text-fg hover:underline"
                          aria-expanded={open === r.id}
                          onClick={() => setOpen(open === r.id ? null : r.id)}
                        >
                          {open === r.id ? <ChevronDown aria-hidden size={14} className="mt-1 shrink-0" /> : <ChevronRight aria-hidden size={14} className="mt-1 shrink-0" />}
                          {r.keyword}
                        </button>
                        <div className="pl-5 text-xs text-muted">
                          {r.locationLabel} · {r.device === "desktop" ? "Desktop" : "Mobile"} · checked {fmtWhen(r.lastCheckedAt)}
                        </div>
                        {r.lastError && <div className="pl-5 text-xs text-warning">{r.lastError}</div>}
                      </TD>
                      <TD numeric>
                        <Position row={r} />
                      </TD>
                      <TD>
                        <Change row={r} />
                      </TD>
                      <TD numeric>{r.best ? `#${r.best}` : "—"}</TD>
                      <TD className="max-w-56">
                        <RankingUrl url={r.url} />
                      </TD>
                      <TD className="max-w-56">
                        <Features list={r.features} />
                      </TD>
                      <TD>
                        <Above row={r} />
                      </TD>
                      <TD>
                        {canEdit && (
                          <Button size="icon-sm" variant="ghost" aria-label={`Stop tracking ${r.keyword}`} loading={busy === `rm:${r.id}`} disabled={busy !== null} onClick={() => remove(r)}>
                            <Trash2 />
                          </Button>
                        )}
                      </TD>
                    </TR>
                    {open === r.id && (
                      <tr className="border-b border-border">
                        <td colSpan={8} className="px-4 py-4">
                          <RankHistoryChart projectId={projectId} keywordId={r.id} keyword={r.keyword} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </div>
          {/* Phones: stacked cards. */}
          <ul className="divide-y divide-border md:hidden">
            {rows.slice(0, shown).map((r) => (
              <li key={r.id} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-fg">{r.keyword}</div>
                    <div className="text-xs text-muted">
                      {r.locationLabel} · {r.device === "desktop" ? "Desktop" : "Mobile"} · checked {fmtWhen(r.lastCheckedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <Position row={r} />
                    <div className="text-xs">
                      <Change row={r} />
                    </div>
                  </div>
                </div>
                {r.lastError && <div className="text-xs text-warning">{r.lastError}</div>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
                  <dt className="text-muted">Best</dt>
                  <dd>{r.best ? `#${r.best}` : "—"}</dd>
                  <dt className="text-muted">Page</dt>
                  <dd className="min-w-0">
                    <RankingUrl url={r.url} />
                  </dd>
                  <dt className="text-muted">Results page</dt>
                  <dd>
                    <Features list={r.features} />
                  </dd>
                  <dt className="text-muted">Above you</dt>
                  <dd>
                    <Above row={r} />
                  </dd>
                </dl>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" icon={<LineChartIcon />} aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? "Hide history" : "History"}
                  </Button>
                  {canEdit && (
                    <Button size="sm" variant="ghost" icon={<Trash2 />} loading={busy === `rm:${r.id}`} disabled={busy !== null} onClick={() => remove(r)}>
                      Remove
                    </Button>
                  )}
                </div>
                {open === r.id && <RankHistoryChart projectId={projectId} keywordId={r.id} keyword={r.keyword} />}
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p className="px-5 py-6 text-small text-muted">No tracked keyword matches “{filter}”.</p>}
          {rows.length > shown && (
            <div className="border-t border-border px-5 py-3">
              <Button size="sm" variant="ghost" onClick={() => setShown(shown + PAGE)}>
                Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
