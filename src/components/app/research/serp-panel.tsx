"use client";
// "Google top 10" tab: one keyword + location + device → Google's current first page, the extra boxes Google shows
// (AI Overview, map pack…), with your site and your saved competitors highlighted. Same check within 24 hours is free.
import { useState } from "react";
import { ExternalLink, Monitor, RefreshCw, Search, Smartphone } from "lucide-react";
import clsx from "clsx";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Notice, Select } from "@/components/ui";
import { DFS_LOCATIONS, LANGUAGES } from "@/lib/dataforseo/locations";
import type { AnnotatedSerp, Device } from "@/lib/research/serp";
import {
  AllowanceMeter, ApiError, RecentSearches, TrackButton, apiJson, fmtDateTime, fmtNum, locationLabel,
  type Allowance, type Overview, type RecentSearch,
} from "./shared";

interface CheckResponse {
  searchId: string | null;
  result: AnnotatedSerp;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
  allowance?: Allowance;
}
interface PastResponse {
  search: RecentSearch;
  result: AnnotatedSerp | null;
  fetchedAt: string | null;
  fresh: boolean;
}
interface Shown {
  searchId: string | null;
  result: AnnotatedSerp;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
}

export function SerpPanel({
  projectId, initial, canSearch, canTrack, ownDomain, competitorCount, initialKeyword,
}: {
  projectId: string;
  initial: Overview;
  canSearch: boolean;
  canTrack: boolean;
  ownDomain: string | null;
  competitorCount: number;
  initialKeyword?: string;
}) {
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [locationId, setLocationId] = useState("in");
  const [languageId, setLanguageId] = useState("en");
  const [device, setDevice] = useState<Device>("mobile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<Allowance>(initial.allowance);
  const [recent, setRecent] = useState<RecentSearch[]>(initial.recent);
  const [shown, setShown] = useState<Shown | null>(null);

  async function refreshRecent() {
    try {
      const o = await apiJson<Overview>(`/api/projects/${projectId}/research/serp`);
      setRecent(o.recent);
      setAllowance(o.allowance);
    } catch {
      /* convenience only */
    }
  }

  async function run(input: { keyword: string; locationId: string; languageId: string; device: Device }) {
    if (!input.keyword.trim()) {
      setError("Type the search you want to check, e.g. “best bakery in pune”.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<CheckResponse>(`/api/projects/${projectId}/research/serp`, { method: "POST", body: JSON.stringify(input) });
      setShown({ searchId: r.searchId, result: r.result, fetchedAt: r.fetchedAt, fromCache: r.fromCache, fresh: r.fresh });
      if (r.allowance) setAllowance(r.allowance);
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
      const r = await apiJson<PastResponse>(`/api/projects/${projectId}/research/serp?search=${encodeURIComponent(s.id)}`);
      setKeyword(s.query);
      setLocationId(s.locationId);
      setLanguageId(s.languageId);
      if (s.device === "mobile" || s.device === "desktop") setDevice(s.device);
      if (!r.result || !r.fetchedAt) {
        setShown(null);
        setError("The saved result for this check is no longer available. Check again to see today's results.");
      } else {
        setShown({ searchId: s.id, result: r.result, fetchedAt: r.fetchedAt, fromCache: true, fresh: r.fresh });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const res = shown?.result;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Check Google's first page"
          description="See exactly who shows up on Google for a search, in a city or country, on a phone or a computer."
          actions={<AllowanceMeter allowance={allowance} what="Checks" />}
        />
        <CardBody>
          <form
            className="grid gap-4 md:grid-cols-[2fr_1.2fr_1fr_1fr_auto] md:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run({ keyword, locationId, languageId, device });
            }}
          >
            <Field label="Search" htmlFor="serp-keyword">
              <Input id="serp-keyword" value={keyword} maxLength={80} placeholder="e.g. ac repair near me" onChange={(e) => setKeyword(e.target.value)} disabled={!canSearch} />
            </Field>
            <Field label="Location" htmlFor="serp-location">
              <Select id="serp-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!canSearch}>
                {DFS_LOCATIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Language" htmlFor="serp-language">
              <Select id="serp-language" value={languageId} onChange={(e) => setLanguageId(e.target.value)} disabled={!canSearch}>
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Device" htmlFor="serp-device">
              <Select id="serp-device" value={device} onChange={(e) => setDevice(e.target.value as Device)} disabled={!canSearch}>
                <option value="mobile">Phone</option>
                <option value="desktop">Computer</option>
              </Select>
            </Field>
            <Button type="submit" icon={<Search />} loading={busy} disabled={!canSearch} className="md:mb-0">
              Check Google
            </Button>
          </form>
          {!canSearch && <p className="mt-3 text-small text-muted">You can open past checks below. Ask a Member, Admin or Owner to run new ones.</p>}
          {error && (
            <Notice tone="warning" className="mt-4">
              {error}
            </Notice>
          )}
          <div className="mt-5 space-y-2">
            <h3 className="text-small font-semibold text-fg">Recent checks</h3>
            <RecentSearches
              items={recent}
              onOpen={openPast}
              activeId={shown?.searchId}
              describe={(s) => `${locationLabel(s.locationId)} · ${s.device === "desktop" ? "computer" : "phone"}`}
            />
          </div>
        </CardBody>
      </Card>

      {!shown || !res ? (
        <EmptyState
          bordered
          picture="search"
          title="Check a search to see Google's top 10."
          description={
            <>
              Each new check uses one from your monthly allowance; the same check again within 24 hours is free.
              {!ownDomain && " Add your website in Settings so we can highlight it."}
              {competitorCount === 0 && " Add competitors in Settings to see them highlighted too."}
            </>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader
              title={`Google top 10 for “${res.keyword}”`}
              description={
                <>
                  {locationLabel(res.locationId)} · {res.device === "desktop" ? "computer" : "phone"} · {res.languageId === "hi" ? "Hindi" : "English"} · checked{" "}
                  {fmtDateTime(shown.fetchedAt)}
                  {shown.fromCache && " · saved result, no check used"}
                </>
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <TrackButton projectId={projectId} keyword={res.keyword} locationId={res.locationId} canEdit={canTrack} />
                  {!shown.fresh && canSearch && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RefreshCw />}
                      loading={busy}
                      onClick={() => void run({ keyword: res.keyword, locationId: res.locationId, languageId: res.languageId, device: res.device })}
                    >
                      Refresh
                    </Button>
                  )}
                </div>
              }
            />
            <CardBody className="space-y-4">
              <YouSummary res={res} />
              {res.organic.length === 0 ? (
                <p className="py-6 text-center text-small text-muted">Google showed no ordinary website results for this search.</p>
              ) : (
                <ol className="divide-y divide-border rounded-xl border border-border">
                  {res.organic.map((r) => (
                    <li
                      key={`${r.position}-${r.url}`}
                      className={clsx(
                        "flex gap-3 p-3 sm:p-4",
                        r.match === "you" && "bg-success/10",
                        r.match === "competitor" && "bg-warning/10",
                      )}
                    >
                      <span className="w-7 shrink-0 text-right text-body font-semibold tabular-nums text-fg">{r.position}</span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs text-muted">{r.domain}</span>
                          {r.match === "you" && <Badge tone="success">You</Badge>}
                          {r.match === "competitor" && <Badge tone="warning">Competitor{r.competitorName ? `: ${r.competitorName}` : ""}</Badge>}
                        </div>
                        <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-start gap-1 break-words text-small font-medium text-primary hover:underline">
                          {r.title}
                          <ExternalLink aria-hidden size={12} className="mt-1 shrink-0" />
                        </a>
                        {r.description && <p className="line-clamp-2 text-xs text-fg-soft">{r.description}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {res.totalResults != null && <p className="text-xs text-muted">Google says about {fmtNum(res.totalResults)} pages match this search.</p>}
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="What else Google shows" description="Boxes on the page besides the ten ordinary results. Each one pushes the ordinary results further down." />
              <CardBody>
                {res.features.length ? (
                  <ul className="space-y-2">
                    {res.features.map((f) => (
                      <li key={f.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                        <Badge tone={f.id === "ai_overview" ? "primary" : "neutral"}>{f.label}</Badge>
                        <span className="text-xs text-muted">{f.explain}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-small text-muted">Just the ordinary results — no extra boxes.</p>
                )}
                {res.aiOverviewSources.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <h4 className="text-small font-semibold text-fg">Sites quoted in the AI Overview</h4>
                    <p className="text-xs text-fg-soft">{res.aiOverviewSources.join(", ")}</p>
                  </div>
                )}
                {res.localPack.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <h4 className="text-small font-semibold text-fg">Businesses in the map pack</h4>
                    <ul className="list-disc pl-5 text-xs text-fg-soft">
                      {res.localPack.map((b) => (
                        <li key={b.title}>{b.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="People also ask" description="Questions Google shows for this search. Answering them on your site can earn you that spot." />
              <CardBody>
                {res.questions.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-small text-fg-soft">
                    {res.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-small text-muted">Google didn&apos;t show a “People also ask” box for this search.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Notice tone="neutral" title="Why your own Google may look different">
        Google personalises results by exact location, history and device. We check from a clean browser in the place you pick, so this is
        what a new customer there sees. <Smartphone aria-hidden size={13} className="inline" /> Phone and <Monitor aria-hidden size={13} className="inline" />{" "}
        computer results often differ.
      </Notice>
    </div>
  );
}

function YouSummary({ res }: { res: AnnotatedSerp }) {
  const bits: string[] = [];
  if (!res.you.domain) bits.push("Add your website to this project to see where you rank.");
  else if (res.you.position) bits.push(`${res.you.domain} is at position ${res.you.position}.`);
  else bits.push(`${res.you.domain} isn't in the top 10 for this search yet.`);
  if (res.you.inAiOverview) bits.push("Google's AI Overview quotes your site.");
  if (res.you.hasFeaturedSnippet) bits.push("You have the featured snippet (the highlighted answer).");
  if (res.competitorsFound.length) {
    bits.push(`Competitors on page one: ${res.competitorsFound.map((c) => `${c.name} (#${c.position})`).join(", ")}.`);
  }
  return (
    <Notice tone={res.you.position ? "success" : "info"} icon={false}>
      {bits.join(" ")}
    </Notice>
  );
}
