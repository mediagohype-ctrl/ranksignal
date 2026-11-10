"use client";
// Google Business Profile monitor: find + pick the business on Google Maps, then show rating/reviews trend, newest
// reviews, completeness checklist and NAP consistency with the website. Data: Places API snapshots (never sample data).
import { useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, HelpCircle, MapPin, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Notice, Stat, Table, TD, TH, THead, TR,
} from "@/components/ui";
import { TrendChart } from "@/components/app/charts";
import { fmtDate, fmtDateTime } from "@/lib/dashboard/format";
import type { BusinessProfileView } from "@/lib/business-profile/service";

interface Candidate {
  placeId: string;
  name: string;
  address: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message ?? "Something went wrong. Please try again.");
  return j as T;
}

const STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: "Open",
  CLOSED_TEMPORARILY: "Temporarily closed",
  CLOSED_PERMANENTLY: "Permanently closed",
};

function CheckIcon({ status }: { status: "pass" | "fix" | "check" }) {
  if (status === "pass") return <CheckCircle2 aria-label="Done" className="size-5 shrink-0 text-success" />;
  if (status === "fix") return <CircleAlert aria-label="Needs fixing" className="size-5 shrink-0 text-danger" />;
  return <HelpCircle aria-label="Worth checking" className="size-5 shrink-0 text-warning" />;
}

const NAP_BADGE: Record<string, { tone: "success" | "danger" | "warning" | "neutral"; label: string }> = {
  match: { tone: "success", label: "Matches" },
  mismatch: { tone: "danger", label: "Different" },
  missing_site: { tone: "warning", label: "Not on website" },
  missing_profile: { tone: "warning", label: "Not on Google" },
};

function Picker({ projectId, onPicked, initialQuery }: { projectId: string; onPicked: (v: BusinessProfileView) => void; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy("search");
    setError(null);
    try {
      const r = await api<{ items: Candidate[] }>(`/api/projects/${projectId}/business-profile/search`, {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setResults(r.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pick(placeId: string) {
    setBusy(placeId);
    setError(null);
    try {
      const r = await api<{ item: BusinessProfileView }>(`/api/projects/${projectId}/business-profile`, {
        method: "POST",
        body: JSON.stringify({ placeId }),
      });
      onPicked(r.item);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Business name and city, e.g. Sharma Dental Clinic Pune"
          aria-label="Business name and city"
          className="flex-1"
          maxLength={200}
        />
        <Button type="submit" icon={<Search />} loading={busy === "search"} disabled={query.trim().length < 2}>
          Find on Google Maps
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {results && results.length === 0 && (
        <Notice tone="neutral">No match on Google Maps. Try the exact name shown on your listing plus the city or area.</Notice>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {results.map((c) => (
            <li key={c.placeId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-fg">{c.name}</div>
                {c.address && <div className="text-small text-muted">{c.address}</div>}
              </div>
              <Button size="sm" variant="secondary" loading={busy === c.placeId} disabled={busy !== null} onClick={() => pick(c.placeId)}>
                This is my business
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BusinessProfileMonitor({
  projectId, initial, canPick, canRefresh, suggestedQuery,
}: {
  projectId: string;
  initial: BusinessProfileView;
  canPick: boolean;
  canRefresh: boolean;
  suggestedQuery: string;
}) {
  const [view, setView] = useState(initial);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = view.profile;
  const s = view.latest;

  async function refresh() {
    setBusy("refresh");
    setError(null);
    try {
      const r = await api<{ item: BusinessProfileView }>(`/api/projects/${projectId}/business-profile/refresh`, { method: "POST" });
      setView(r.item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Stop monitoring this business? Its rating and review history here will be deleted.")) return;
    setBusy("remove");
    setError(null);
    try {
      await api(`/api/projects/${projectId}/business-profile`, { method: "DELETE" });
      setView({ ...view, profile: null, latest: null, checklist: [], score: null, trend: [], nap: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!p || changing) {
    return (
      <Card>
        <CardHeader
          icon={<MapPin />}
          title={changing ? "Pick a different business" : "Find your business on Google Maps"}
          description="Search for your listing and pick it. We then check it every week: rating, reviews, missing details, and whether it matches your website."
          actions={changing ? <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>Cancel</Button> : undefined}
        />
        <CardBody>
          {canPick ? (
            <Picker
              projectId={projectId}
              initialQuery={suggestedQuery}
              onPicked={(v) => {
                setView(v);
                setChanging(false);
              }}
            />
          ) : (
            <p className="text-small text-muted">Ask an Owner or Admin of this workspace to pick the business.</p>
          )}
        </CardBody>
      </Card>
    );
  }

  const trendPoints = view.trend.filter((t) => t.rating != null || t.reviewCount != null);
  const ratingData = trendPoints.filter((t) => t.rating != null).map((t) => ({ label: fmtDate(t.takenAt), value: t.rating as number }));
  const reviewData = trendPoints.filter((t) => t.reviewCount != null).map((t) => ({ label: fmtDate(t.takenAt), value: t.reviewCount as number }));
  const first = trendPoints[0];
  const reviewDelta = s?.reviewCount != null && first?.reviewCount != null && trendPoints.length > 1 ? s.reviewCount - first.reviewCount : null;
  const ratingDelta =
    s?.rating != null && first?.rating != null && trendPoints.length > 1 ? Math.round((s.rating - first.rating) * 10) / 10 : null;
  const maxReviews = Math.max(10, ...reviewData.map((d) => d.value));

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h3 text-fg">{s?.name ?? p.name}</h2>
              {s?.businessStatus && (
                <Badge tone={s.businessStatus === "OPERATIONAL" ? "success" : "danger"}>{STATUS_LABEL[s.businessStatus] ?? s.businessStatus}</Badge>
              )}
              {s?.category && <Badge>{s.category}</Badge>}
            </div>
            {(s?.address ?? p.address) && <p className="mt-1 text-small text-muted">{s?.address ?? p.address}</p>}
            <p className="mt-2 text-xs text-muted">
              Last checked {p.lastSnapshotAt ? fmtDateTime(p.lastSnapshotAt) : "not yet"} · checked every {p.refreshDays} days on your plan
              {p.nextSnapshotAt ? ` · next around ${fmtDate(p.nextSnapshotAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {s?.mapsUri && (
              <a href={s.mapsUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-small font-medium text-primary hover:underline">
                Open in Google Maps <ExternalLink aria-hidden size={14} />
              </a>
            )}
            {canRefresh && (
              <Button size="sm" variant="secondary" icon={<RefreshCw />} loading={busy === "refresh"} onClick={refresh}>
                Refresh now
              </Button>
            )}
            {canPick && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>
                  Change business
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash2 />} loading={busy === "remove"} onClick={remove}>
                  Stop monitoring
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {error && <Notice tone="warning">{error}</Notice>}
      {p.lastError && <Notice tone="warning" title="The last check didn't work">{p.lastError}</Notice>}

      {!s ? (
        <EmptyState bordered picture="chart" title="No check yet." description="The first check runs within a few minutes." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Google rating"
              value={s.rating != null ? s.rating.toFixed(1) : "–"}
              icon={<Star />}
              delta={ratingDelta}
              deltaLabel="since first check"
            />
            <Stat label="Reviews" value={s.reviewCount != null ? s.reviewCount.toLocaleString("en-IN") : "–"} delta={reviewDelta} deltaLabel="since first check" />
            <Stat
              label="Profile completeness"
              value={view.score ? `${view.score.passed}/${view.score.total}` : "–"}
              hint="Checks passed (below)"
            />
          </div>

          <Card>
            <CardHeader title="What to fix on your listing" description="From what Google Maps shows the public. Fix these in your Google Business Profile (business.google.com)." />
            <CardBody>
              <ul className="space-y-3">
                {view.checklist.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <CheckIcon status={c.status} />
                    <div className="min-w-0">
                      <div className="font-medium text-fg">{c.label}</div>
                      <div className="break-words text-small text-muted">{c.detail}</div>
                      {c.fix && <div className="mt-0.5 text-small text-fg-soft">{c.fix}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">
                Google Maps&apos; public data shows at most {view.limits.maxPhotos} photos, so &quot;{view.limits.maxPhotos}+&quot; means at least that many.
              </p>
            </CardBody>
          </Card>

          {view.nap && (
            <Card>
              <CardHeader
                title="Does Google match your website?"
                description="Your name, address, phone and website should be written the same way on Google and on your site. Mismatches confuse Google and AI assistants."
              />
              <CardBody>
                <Table framed density="compact" caption="Name, address and phone consistency">
                  <THead>
                    <tr>
                      <TH>Detail</TH>
                      <TH>On Google</TH>
                      <TH>On your website</TH>
                      <TH>Result</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {view.nap.rows.map((r) => (
                      <TR key={r.field}>
                        <TD className="font-medium text-fg">{r.label}</TD>
                        <TD className="max-w-[14rem] break-words">{r.profile ?? "–"}</TD>
                        <TD className="max-w-[14rem] break-words">{r.site ?? "–"}</TD>
                        <TD>
                          <Badge tone={NAP_BADGE[r.status].tone}>{NAP_BADGE[r.status].label}</Badge>
                          {r.fix && <div className="mt-1 max-w-[18rem] text-xs text-muted">{r.fix}</div>}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
                <p className="mt-3 text-xs text-muted">
                  {view.nap.crawledAt
                    ? `Website details from your Organization/LocalBusiness schema and contact page in the website check of ${fmtDate(view.nap.crawledAt)}.`
                    : "We haven't checked your website yet, so the website column is empty. Run a website check to compare."}
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Rating and reviews over time" description="One point per check." />
            <CardBody>
              {trendPoints.length < 2 ? (
                <p className="text-small text-muted">The trend appears after the second weekly check.</p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-1 text-caption uppercase tracking-wider text-muted">Rating</div>
                    <TrendChart data={ratingData} name="Rating" domain={[1, 5]} format={(v) => v.toFixed(1)} height={200} />
                  </div>
                  <div>
                    <div className="mb-1 text-caption uppercase tracking-wider text-muted">Number of reviews</div>
                    <TrendChart data={reviewData} name="Reviews" domain={[0, Math.ceil(maxReviews * 1.1)]} height={200} />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Newest reviews"
              description={`Google Maps' public data gives at most ${view.limits.maxReviews} reviews (Google picks them), so this isn't every review.`}
            />
            <CardBody>
              {s.reviews.length === 0 ? (
                <p className="text-small text-muted">No reviews returned.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {s.reviews.map((r, i) => (
                    <li key={`${r.publishTime ?? i}-${r.author ?? i}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 text-small">
                        <span className="font-medium text-fg">
                          {r.authorUri ? (
                            <a href={r.authorUri} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {r.author ?? "A Google user"}
                            </a>
                          ) : (
                            r.author ?? "A Google user"
                          )}
                        </span>
                        {r.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${r.rating} out of 5 stars`}>
                            {Array.from({ length: 5 }, (_, k) => (
                              <Star key={k} aria-hidden size={13} className={k < (r.rating ?? 0) ? "fill-warning" : "opacity-30"} />
                            ))}
                          </span>
                        )}
                        {r.when && <span className="text-muted">{r.when}</span>}
                      </div>
                      {r.text && <p className="mt-1 whitespace-pre-line break-words text-small text-fg-soft">{r.text}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">Reviews from Google Maps. Replying to reviews still happens in your Google Business Profile.</p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
