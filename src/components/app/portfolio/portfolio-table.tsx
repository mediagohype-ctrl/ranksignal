"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";
import {
  filterPortfolio,
  needsAttention,
  sortPortfolio,
  type MonthlyState,
  type PortfolioFilter,
  type PortfolioRow,
  type PortfolioSortKey,
} from "@/lib/portfolio/build";
import { Badge, EmptyState, Field, Input, ScoreRing, Select, Table, TD, TH, THead, TR, scoreBand, SCORE_BAND_CLASS } from "@/components/ui";

const PILLAR_LABEL = { seo: "SEO", aeo: "AEO", geo: "GEO", brand: "Brand" } as const;

const MONTHLY_BADGE: Record<MonthlyState, { tone: "success" | "info" | "warning" | "neutral"; label: string }> = {
  sent: { tone: "success", label: "Sent" },
  reviewed: { tone: "info", label: "Ready to send" },
  draft: { tone: "warning", label: "Draft" },
  none: { tone: "neutral", label: "Not made" },
};

const SORTS: { key: PortfolioSortKey; label: string; dir: "asc" | "desc" }[] = [
  { key: "urgent", label: "Most urgent problems", dir: "desc" },
  { key: "score", label: "Lowest score", dir: "asc" },
  { key: "score", label: "Highest score", dir: "desc" },
  { key: "change", label: "Biggest drop", dir: "asc" },
  { key: "change", label: "Biggest gain", dir: "desc" },
  { key: "mention", label: "Lowest AI mention rate", dir: "asc" },
  { key: "lastCheck", label: "Oldest check", dir: "asc" },
  { key: "name", label: "Name (A–Z)", dir: "asc" },
];

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted">—</span>;
  if (v === 0) return <span className="text-muted">No change</span>;
  const up = v > 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 font-medium tabular-nums", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />}
      {up ? "+" : "−"}
      {Math.abs(v)}
      <span className="sr-only">{up ? " points up" : " points down"} since the previous check</span>
    </span>
  );
}

function Pill({ label, score }: { label: string; score: number | null }) {
  const band = SCORE_BAND_CLASS[scoreBand(score)];
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted">{label}</span>
      <span className={clsx("font-semibold tabular-nums", band.text)}>{score ?? "—"}</span>
    </span>
  );
}

function Running({ r }: { r: PortfolioRow }) {
  if (!r.running) return null;
  const text = r.running === "both" ? "Checking website + AI" : r.running === "website" ? "Checking website" : "Asking AI tools";
  return (
    <Badge tone="info" icon={<Loader2 className="animate-spin" />}>
      {text}
    </Badge>
  );
}

const mention = (r: PortfolioRow) => (r.mentionRate === null ? "—" : `${Math.round(r.mentionRate * 100)}%`);

export function PortfolioTable({
  rows,
  lastCheckLabels,
  monthLabel,
}: {
  rows: PortfolioRow[];
  /** Pre-formatted on the server (user's time zone) to avoid hydration drift. */
  lastCheckLabels: Record<string, string>;
  monthLabel: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PortfolioFilter>("all");
  const [sortIdx, setSortIdx] = useState(0);

  const shown = useMemo(() => {
    const s = SORTS[sortIdx] ?? SORTS[0];
    return sortPortfolio(filterPortfolio(rows, { q, filter }), s.key, s.dir);
  }, [rows, q, filter, sortIdx]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <Field label="Search" htmlFor="pf-q">
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input id="pf-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or website" className="pl-9" />
          </div>
        </Field>
        <Field label="Show" htmlFor="pf-filter">
          <Select id="pf-filter" value={filter} onChange={(e) => setFilter(e.target.value as PortfolioFilter)}>
            <option value="all">All websites</option>
            <option value="attention">Needs attention</option>
            <option value="running">Being checked now</option>
            <option value="never_checked">Never checked</option>
            <option value="monthly_pending">{`${monthLabel} report not sent`}</option>
          </Select>
        </Field>
        <Field label="Sort by" htmlFor="pf-sort">
          <Select id="pf-sort" value={String(sortIdx)} onChange={(e) => setSortIdx(Number(e.target.value))}>
            {SORTS.map((s, i) => (
              <option key={`${s.key}-${s.dir}`} value={i}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="text-small text-muted" aria-live="polite">
        Showing {shown.length} of {rows.length} website{rows.length === 1 ? "" : "s"}.
      </p>

      {shown.length === 0 ? (
        <EmptyState size="sm" bordered picture="search" title="No websites match these filters." />
      ) : (
        <>
          {/* Phone: cards. */}
          <ul className="space-y-3 lg:hidden">
            {shown.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/app/projects/${r.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 hover:border-border-strong"
                >
                  <div className="flex items-start gap-3">
                    <ScoreRing score={r.score} size="sm" label={`${r.name} overall score`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-fg">{r.name}</p>
                      <p className="truncate text-xs text-muted">{r.host}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-small">
                        <Change v={r.scoreChange} />
                        {needsAttention(r) && <Badge tone="danger">Needs attention</Badge>}
                        <Running r={r} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    {(Object.keys(PILLAR_LABEL) as (keyof typeof PILLAR_LABEL)[]).map((p) => (
                      <Pill key={p} label={PILLAR_LABEL[p]} score={r.pillars[p]} />
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted">AI mentions you</dt>
                      <dd className="font-medium text-fg">{mention(r)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Urgent problems</dt>
                      <dd className="font-medium text-fg">{r.urgent ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Last check</dt>
                      <dd className="font-medium text-fg">{lastCheckLabels[r.id] ?? "Never"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{monthLabel} report</dt>
                      <dd>
                        <Badge tone={MONTHLY_BADGE[r.monthly].tone}>{MONTHLY_BADGE[r.monthly].label}</Badge>
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Wide screens: table. */}
          <div className="hidden lg:block">
            <Table framed caption="All websites">
              <THead>
                <tr>
                  <TH>Website</TH>
                  <TH align="right">Score</TH>
                  <TH align="right">Change</TH>
                  <TH>Scores by area</TH>
                  <TH align="right">AI mentions you</TH>
                  <TH align="right">Urgent problems</TH>
                  <TH>Last check</TH>
                  <TH>{monthLabel} report</TH>
                </tr>
              </THead>
              <tbody>
                {shown.map((r) => (
                  <TR key={r.id}>
                    <TD className="min-w-48">
                      <Link href={`/app/projects/${r.id}`} className="font-semibold text-fg hover:underline">
                        {r.name}
                      </Link>
                      <span className="block text-xs text-muted">{r.host}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {needsAttention(r) && <Badge tone="danger">Needs attention</Badge>}
                        <Running r={r} />
                      </span>
                    </TD>
                    <TD numeric>
                      <span className={clsx("text-body font-semibold", SCORE_BAND_CLASS[scoreBand(r.score)].text)}>{r.score ?? "—"}</span>
                    </TD>
                    <TD numeric>
                      <Change v={r.scoreChange} />
                    </TD>
                    <TD>
                      <span className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {(Object.keys(PILLAR_LABEL) as (keyof typeof PILLAR_LABEL)[]).map((p) => (
                          <Pill key={p} label={PILLAR_LABEL[p]} score={r.pillars[p]} />
                        ))}
                      </span>
                    </TD>
                    <TD numeric>{mention(r)}</TD>
                    <TD numeric>
                      {r.urgent === null ? (
                        "—"
                      ) : (
                        <Link
                          href={`/app/projects/${r.id}/todo`}
                          className={clsx("font-semibold hover:underline", r.urgent > 0 ? "text-danger" : "text-fg-soft")}
                        >
                          {r.urgent}
                        </Link>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">{lastCheckLabels[r.id] ?? "Never"}</TD>
                    <TD>
                      <Link href={`/app/projects/${r.id}/monthly`}>
                        <Badge tone={MONTHLY_BADGE[r.monthly].tone}>{MONTHLY_BADGE[r.monthly].label}</Badge>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
