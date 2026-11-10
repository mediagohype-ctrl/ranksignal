"use client";
// "Keyword ideas" tab: search form, result table (filters, sort, CSV) and the questions people ask. Results come from
// /api/projects/[id]/research/keywords; repeat searches within 30 days are served from the shared cache for free.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, HelpCircle, RefreshCw, Search } from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Notice, Select, Table, TD, TH, THead, TR,
} from "@/components/ui";
import { DFS_LOCATIONS, LANGUAGES } from "@/lib/dataforseo/locations";
import {
  DIFFICULTY_INFO, INR_PER_USD, INTENT_INFO, KEYWORD_MODES, cpcInr, difficultyBand, filterKeywords, keywordsToCsv,
  type DifficultyBand, type Intent, type KeywordIdea, type KeywordMode, type KeywordResult, type KeywordSort,
} from "@/lib/research/keywords";
import {
  AllowanceMeter, ApiError, RecentSearches, Sparkline, TrackButton, apiJson, fmtDate, fmtNum, locationLabel,
  type Allowance, type Overview, type RecentSearch,
} from "./shared";

interface LookupResponse {
  searchId: string | null;
  result: KeywordResult;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
  countryLevel?: boolean;
  allowance?: Allowance;
}
interface PastResponse {
  search: RecentSearch;
  result: KeywordResult | null;
  fetchedAt: string | null;
  fresh: boolean;
}
interface Shown {
  searchId: string | null;
  result: KeywordResult;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
  locationId: string;
}

const PAGE = 50;
const DIFF_TONE: Record<DifficultyBand, "success" | "warning" | "danger"> = { easy: "success", medium: "warning", hard: "danger" };
const COUNTRY_OF: Record<number, string> = Object.fromEntries(
  DFS_LOCATIONS.filter((l) => l.locationCode !== undefined).map((l) => [l.locationCode!, l.label]),
);

function DifficultyCell({ kd }: { kd: number | null }) {
  const band = difficultyBand(kd);
  if (!band) return <span className="text-muted">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title={DIFFICULTY_INFO[band].explain}>
      <span className="tabular-nums">{kd}</span>
      <Badge tone={DIFF_TONE[band]}>{DIFFICULTY_INFO[band].label}</Badge>
    </span>
  );
}

function IntentCell({ intent }: { intent: Intent | null }) {
  if (!intent) return <span className="text-muted">–</span>;
  return (
    <span title={INTENT_INFO[intent].explain}>
      <Badge tone="neutral">{INTENT_INFO[intent].label}</Badge>
    </span>
  );
}

function Cpc({ usd }: { usd: number | null }) {
  const inr = cpcInr(usd);
  if (inr === null) return <span className="text-muted">–</span>;
  return <span className="tabular-nums">≈ ₹{inr < 10 ? inr.toFixed(2) : Math.round(inr).toLocaleString("en-IN")}</span>;
}

export function KeywordIdeasPanel({
  projectId, initial, canSearch, canTrack,
}: {
  projectId: string;
  initial: Overview;
  canSearch: boolean;
  canTrack: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [locationId, setLocationId] = useState("in");
  const [languageId, setLanguageId] = useState("en");
  const [mode, setMode] = useState<KeywordMode>("suggestions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<Allowance>(initial.allowance);
  const [recent, setRecent] = useState<RecentSearch[]>(initial.recent);
  const [shown, setShown] = useState<Shown | null>(null);

  // table state
  const [contains, setContains] = useState("");
  const [questionsOnly, setQuestionsOnly] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyBand | "all">("all");
  const [intent, setIntent] = useState<Intent | "all">("all");
  const [sort, setSort] = useState<KeywordSort>("volume");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(
    () => (shown ? filterKeywords(shown.result.items ?? [], { contains, questionsOnly, difficulty, intent, sort, dir }) : []),
    [shown, contains, questionsOnly, difficulty, intent, sort, dir],
  );
  const questions = useMemo(
    () => (shown ? (shown.result.items ?? []).filter((k) => k.isQuestion).slice(0, 15) : []),
    [shown],
  );

  function resetTable() {
    setContains("");
    setQuestionsOnly(false);
    setDifficulty("all");
    setIntent("all");
    setSort("volume");
    setDir("desc");
    setLimit(PAGE);
  }

  async function refreshRecent() {
    try {
      const o = await apiJson<Overview>(`/api/projects/${projectId}/research/keywords`);
      setRecent(o.recent);
      setAllowance(o.allowance);
    } catch {
      /* the list is a convenience */
    }
  }

  async function run(input: { keyword: string; locationId: string; languageId: string; mode: KeywordMode }) {
    if (!input.keyword.trim()) {
      setError("Type a word or short phrase first, e.g. “wedding photographer”.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<LookupResponse>(`/api/projects/${projectId}/research/keywords`, { method: "POST", body: JSON.stringify(input) });
      setShown({ searchId: r.searchId, result: r.result, fetchedAt: r.fetchedAt, fromCache: r.fromCache, fresh: r.fresh, locationId: input.locationId });
      if (r.allowance) setAllowance(r.allowance);
      resetTable();
      void refreshRecent();
    } catch (e) {
      if (e instanceof ApiError && e.allowance) setAllowance(e.allowance);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openPast(s: RecentSearch) {
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<PastResponse>(`/api/projects/${projectId}/research/keywords?search=${encodeURIComponent(s.id)}`);
      setKeyword(s.query);
      setLocationId(s.locationId);
      setLanguageId(s.languageId);
      if (s.mode === "ideas" || s.mode === "suggestions") setMode(s.mode);
      if (!r.result || !r.fetchedAt) {
        setShown(null);
        setError("The saved results for this search have expired. Search again to get fresh numbers.");
      } else {
        setShown({ searchId: s.id, result: r.result, fetchedAt: r.fetchedAt, fromCache: true, fresh: r.fresh, locationId: s.locationId });
        resetTable();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sortBy(k: KeywordSort) {
    if (k === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir(k === "keyword" || k === "difficulty" ? "asc" : "desc");
    }
  }

  function SortHead({ k, children, align }: { k: KeywordSort; children: React.ReactNode; align?: "right" }) {
    const active = sort === k;
    const Icon = dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TH align={align}>
        <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 uppercase hover:text-fg" aria-label={`Sort by ${String(children)}`}>
          {children}
          {active && <Icon aria-hidden size={12} />}
        </button>
      </TH>
    );
  }

  function downloadCsv() {
    if (!shown) return;
    const blob = new Blob(["﻿" + keywordsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyword-ideas-${shown.result.seed.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const outOfAllowance = allowance.remaining < 1;
  const countryName = shown ? COUNTRY_OF[shown.result.countryCode] ?? "the country" : "";
  const visible = rows.slice(0, limit);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Find keywords"
          description="Type what you sell or a topic. We show what people actually type into Google, how many search each month, and how hard it is to rank."
          actions={<AllowanceMeter allowance={allowance} what="Lookups" />}
        />
        <CardBody>
          <form
            className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1.4fr_auto] md:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ keyword, locationId, languageId, mode });
            }}
          >
            <Field label="Topic or keyword" htmlFor="kr-keyword">
              <Input id="kr-keyword" value={keyword} maxLength={80} placeholder="e.g. dentist, yoga classes, cake shop" onChange={(e) => setKeyword(e.target.value)} disabled={!canSearch} />
            </Field>
            <Field label="Country" htmlFor="kr-location" hint="Monthly searches are per country.">
              <Select id="kr-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!canSearch}>
                {DFS_LOCATIONS.filter((l) => l.locationCode !== undefined).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" htmlFor="kr-language">
              <Select id="kr-language" value={languageId} onChange={(e) => setLanguageId(e.target.value)} disabled={!canSearch}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Show" htmlFor="kr-mode" hint={KEYWORD_MODES.find((m) => m.id === mode)?.hint}>
              <Select id="kr-mode" value={mode} onChange={(e) => setMode(e.target.value as KeywordMode)} disabled={!canSearch}>
                {KEYWORD_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" icon={<Search />} loading={busy} disabled={!canSearch} className="md:mb-[1.6rem]">
              Find keywords
            </Button>
          </form>
          {!canSearch && <p className="mt-3 text-small text-muted">You can open past searches below. Ask a Member, Admin or Owner to run new ones.</p>}
          {outOfAllowance && canSearch && (
            <p className="mt-3 text-small text-muted">Your monthly lookups are used up, but searches made in the last 30 days still open for free.</p>
          )}
          {error && (
            <Notice tone="warning" className="mt-4">
              {error}
            </Notice>
          )}
          <div className="mt-5 space-y-2">
            <h3 className="text-small font-semibold text-fg">Recent searches</h3>
            <RecentSearches
              items={recent}
              onOpen={openPast}
              activeId={shown?.searchId}
              describe={(s) => `${locationLabel(s.locationId)}${s.languageId === "hi" ? " · Hindi" : ""}`}
            />
          </div>
        </CardBody>
      </Card>

      {!shown ? (
        <EmptyState
          bordered
          picture="search"
          title="Search a topic to see keyword ideas."
          description="Each new search uses one lookup from your monthly allowance. The same search again within 30 days is free."
        />
      ) : (
        <>
          <Card>
            <CardHeader
              title={`${fmtNum(shown.result.items?.length ?? 0)} keyword ideas for “${shown.result.seed}”`}
              description={
                <>
                  {countryName} · {shown.result.languageId === "hi" ? "Hindi" : "English"} · Updated {fmtDate(shown.fetchedAt)}
                  {shown.fromCache && " · saved result, no lookup used"}
                </>
              }
              actions={
                <div className="flex flex-wrap gap-2">
                  {!shown.fresh && canSearch && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw />}
                      loading={busy}
                      onClick={() => void run({ keyword: shown.result.seed, locationId: shown.locationId, languageId: shown.result.languageId, mode: shown.result.mode })}
                    >
                      Refresh
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={<Download />} onClick={downloadCsv} disabled={!rows.length}>
                    Download CSV
                  </Button>
                </div>
              }
            />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
                <Field label="Contains word" htmlFor="kr-contains">
                  <Input id="kr-contains" inputSize="sm" value={contains} placeholder="e.g. price, near me" onChange={(e) => { setContains(e.target.value); setLimit(PAGE); }} />
                </Field>
                <Field label="Difficulty" htmlFor="kr-diff">
                  <Select id="kr-diff" inputSize="sm" value={difficulty} onChange={(e) => { setDifficulty(e.target.value as DifficultyBand | "all"); setLimit(PAGE); }}>
                    <option value="all">Any</option>
                    {(Object.keys(DIFFICULTY_INFO) as DifficultyBand[]).map((b) => (
                      <option key={b} value={b}>
                        {DIFFICULTY_INFO[b].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Search intent" htmlFor="kr-intent">
                  <Select id="kr-intent" inputSize="sm" value={intent} onChange={(e) => { setIntent(e.target.value as Intent | "all"); setLimit(PAGE); }}>
                    <option value="all">Any</option>
                    {(Object.keys(INTENT_INFO) as Intent[]).map((i) => (
                      <option key={i} value={i}>
                        {INTENT_INFO[i].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="inline-flex h-8 items-center gap-2 text-small text-fg-soft">
                  <input type="checkbox" checked={questionsOnly} onChange={(e) => { setQuestionsOnly(e.target.checked); setLimit(PAGE); }} className="size-4 accent-[var(--primary)]" />
                  Questions only
                </label>
              </div>
              {/* Phone: sort picker (the table headers sort on wider screens). */}
              <div className="flex items-center gap-2 md:hidden">
                <label htmlFor="kr-sort" className="text-small text-muted">
                  Sort by
                </label>
                <Select id="kr-sort" inputSize="sm" value={`${sort}:${dir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); setSort(s as KeywordSort); setDir(d as "asc" | "desc"); }} className="w-auto">
                  <option value="volume:desc">Most searched</option>
                  <option value="difficulty:asc">Easiest first</option>
                  <option value="cpc:desc">Highest cost per click</option>
                  <option value="keyword:asc">A to Z</option>
                </Select>
              </div>

              {!rows.length ? (
                <p className="py-6 text-center text-small text-muted">
                  {(shown.result.items?.length ?? 0) === 0
                    ? "Google has no data for this search yet. Try a shorter or more common phrase."
                    : "No keywords match these filters."}
                </p>
              ) : (
                <>
                  <ul className="space-y-3 md:hidden">
                    {visible.map((k) => (
                      <KeywordCard key={k.keyword} k={k} projectId={projectId} locationId={shown.locationId} canTrack={canTrack} />
                    ))}
                  </ul>
                  <div className="hidden md:block">
                    <Table framed caption={`Keyword ideas for ${shown.result.seed}`} density="compact">
                      <THead>
                        <tr>
                          <SortHead k="keyword">Keyword</SortHead>
                          <SortHead k="volume" align="right">Monthly searches</SortHead>
                          <SortHead k="difficulty">Difficulty</SortHead>
                          <TH>Intent</TH>
                          <SortHead k="cpc" align="right">Cost per click</SortHead>
                          <TH>12 months</TH>
                          <TH>
                            <span className="sr-only">Track</span>
                          </TH>
                        </tr>
                      </THead>
                      <tbody>
                        {visible.map((k) => (
                          <TR key={k.keyword}>
                            <TD className="font-medium text-fg">
                              {k.keyword}
                              {k.isQuestion && (
                                <Badge tone="info" className="ml-2">
                                  Question
                                </Badge>
                              )}
                            </TD>
                            <TD numeric>{fmtNum(k.volume)}</TD>
                            <TD>
                              <DifficultyCell kd={k.difficulty} />
                            </TD>
                            <TD>
                              <IntentCell intent={k.intent} />
                            </TD>
                            <TD numeric>
                              <Cpc usd={k.cpcUsd} />
                            </TD>
                            <TD>
                              <Sparkline points={k.trend} />
                            </TD>
                            <TD align="right">
                              <TrackButton projectId={projectId} keyword={k.keyword} locationId={shown.locationId} canEdit={canTrack} />
                            </TD>
                          </TR>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
                    <span>
                      Showing {fmtNum(visible.length)} of {fmtNum(rows.length)}
                    </span>
                    {rows.length > limit && (
                      <Button size="sm" variant="ghost" onClick={() => setLimit(limit + PAGE)}>
                        Show more
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<HelpCircle />} title="Questions people ask" description="Answer these on your website (an FAQ or a short article). They are also what AI assistants get asked." />
            <CardBody>
              {questions.length ? (
                <ul className="divide-y divide-border">
                  {questions.map((q) => (
                    <li key={q.keyword} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-small text-fg">{q.keyword}</span>
                      <span className="text-xs text-muted">{q.volume == null ? "no volume data" : `${fmtNum(q.volume)} searches a month`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted">No question-style searches for this topic. Try “Related topics” or a broader word.</p>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <Notice tone="neutral" title="What these numbers mean">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Monthly searches</strong>: the average number of Google searches per month over the last year, for the whole country. Google
            doesn&apos;t publish city-level numbers, and rounds small ones.
          </li>
          <li>
            <strong>Difficulty</strong> (0–100): how hard it is to reach Google&apos;s first page. {DIFFICULTY_INFO.easy.explain} {DIFFICULTY_INFO.medium.explain}{" "}
            {DIFFICULTY_INFO.hard.explain}
          </li>
          <li>
            <strong>Intent</strong>: what the searcher wants. {(Object.keys(INTENT_INFO) as Intent[]).map((i) => `${INTENT_INFO[i].label} — ${INTENT_INFO[i].explain}`).join(" ")}
          </li>
          <li>
            <strong>Cost per click</strong>: roughly what advertisers pay Google for one click on an ad for this search, converted from US dollars at about ₹
            {INR_PER_USD} per $. A high number usually means the search brings in paying customers.
          </li>
        </ul>
      </Notice>
    </div>
  );
}

function KeywordCard({ k, projectId, locationId, canTrack }: { k: KeywordIdea; projectId: string; locationId: string; canTrack: boolean }) {
  return (
    <li className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-small font-medium text-fg">
          {k.keyword}
          {k.isQuestion && (
            <Badge tone="info" className="ml-2">
              Question
            </Badge>
          )}
        </p>
        <TrackButton projectId={projectId} keyword={k.keyword} locationId={locationId} canEdit={canTrack} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">Monthly searches</dt>
        <dd className="text-right tabular-nums text-fg">{fmtNum(k.volume)}</dd>
        <dt className="text-muted">Difficulty</dt>
        <dd className="text-right">
          <DifficultyCell kd={k.difficulty} />
        </dd>
        <dt className="text-muted">Intent</dt>
        <dd className="text-right">
          <IntentCell intent={k.intent} />
        </dd>
        <dt className="text-muted">Cost per click</dt>
        <dd className="text-right">
          <Cpc usd={k.cpcUsd} />
        </dd>
        <dt className="text-muted">Last 12 months</dt>
        <dd className="flex justify-end">
          <Sparkline points={k.trend} />
        </dd>
      </dl>
    </li>
  );
}
