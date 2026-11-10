// Shared marketing visual: a grid of tiny product mockups — one per main part of the app. Server component, HTML +
// inline SVG only. SVG shapes are decorative (aria-hidden); every number and label they show is also real HTML text
// beside them. All data is sample data. Features that need our paid Google-data partner show "Switching on soon"
// until it is configured (env-only check — safe on marketing pages).
import type { ReactNode } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { SampleTag } from "@/components/marketing/home-ui";
import { BRAND } from "@/lib/brand";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";

type HeadingTag = "h3" | "h4" | "p";

/* ------------------------------------------------------------------ mini mockups (sample data) */

function ScoreMock() {
  const score = 64;
  const r = 26;
  const c = 2 * Math.PI * r;
  const rows = [
    { label: "SEO", v: 78, tone: "bg-score-good" },
    { label: "AEO", v: 54, tone: "bg-score-ok" },
    { label: "GEO", v: 41, tone: "bg-score-poor" },
  ];
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative size-[68px] shrink-0">
        <svg aria-hidden viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-score-track" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
            className="stroke-score-ok"
          />
        </svg>
        <p className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[1.125rem] font-semibold tabular-nums text-fg">{score}</span>
          <span className="mt-0.5 text-[10px] text-muted">/ 100</span>
        </p>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[2.25rem_1fr_1.5rem] items-center gap-2 text-[11px]">
            <span className="font-medium text-fg">{r.label}</span>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-score-track">
              <span className={clsx("block h-full rounded-full", r.tone)} style={{ width: `${r.v}%` }} />
            </span>
            <span className="text-right tabular-nums text-fg-soft">{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarRows({ rows, unit = "%", max = 100 }: { rows: { label: string; v: number; tone: string }[]; unit?: string; max?: number }) {
  return (
    <ul className="flex h-full flex-col justify-center space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,5.75rem)_1fr_2rem] items-center gap-2 text-[11px]">
          <span className="truncate font-medium text-fg">{r.label}</span>
          <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full">
            <rect width="100" height="8" rx="4" className="fill-chart-grid" />
            <rect width={(r.v / max) * 100} height="8" rx="4" className={r.tone} />
          </svg>
          <span className="text-right tabular-nums text-fg-soft">
            {r.v}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AnswersMock() {
  return (
    <BarRows
      rows={[
        { label: "ChatGPT", v: 42, tone: "fill-chart-1" },
        { label: "Gemini", v: 31, tone: "fill-chart-2" },
        { label: "Perplexity", v: 38, tone: "fill-chart-5" },
        { label: "Claude", v: 18, tone: "fill-chart-4" },
      ]}
    />
  );
}

function FixesMock() {
  const items = [
    { t: "Say where you deliver", p: 9, done: true },
    { t: "Add a Google summary", p: 6, done: false },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.t} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[11px]">
            <span
              aria-hidden
              className={clsx(
                "inline-flex size-4 shrink-0 items-center justify-center rounded",
                it.done ? "bg-score-good text-primary-fg" : "border border-border-strong",
              )}
            >
              {it.done && <Check size={11} strokeWidth={3} />}
            </span>
            <span className={clsx("min-w-0 flex-1 truncate", it.done ? "text-muted line-through" : "font-medium text-fg")}>
              {it.done && <span className="sr-only">Done: </span>}
              {it.t}
            </span>
            <span className="shrink-0 rounded-full bg-score-good-soft px-1.5 py-0.5 font-semibold tabular-nums text-score-good">+{it.p}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-fg px-3 text-[11px] font-medium text-bg">
          <Check aria-hidden size={12} strokeWidth={2.5} />
          Approve
        </span>
        <span className="text-[11px] text-muted">You can undo it later</span>
      </div>
    </div>
  );
}

function SpeedMock() {
  const rows = [
    { k: "Loading", v: "2.1 s", s: "Good", tone: "bg-score-good", soft: "text-score-good" },
    { k: "Response", v: "180 ms", s: "Good", tone: "bg-score-good", soft: "text-score-good" },
    { k: "Layout shift", v: "0.18", s: "Needs work", tone: "bg-score-ok", soft: "text-score-ok" },
  ];
  return (
    <ul className="flex h-full flex-col justify-center divide-y divide-border">
      {rows.map((r) => (
        <li key={r.k} className="flex items-center gap-2 py-1.5 text-[11px]">
          <span aria-hidden className={clsx("size-2 shrink-0 rounded-full", r.tone)} />
          <span className="min-w-0 flex-1 truncate text-fg">{r.k}</span>
          <span className="tabular-nums text-fg-soft">{r.v}</span>
          <span className={clsx("w-[4.5rem] text-right font-medium", r.soft)}>{r.s}</span>
        </li>
      ))}
    </ul>
  );
}

const RANKS = [14, 12, 12, 9, 8, 6, 4, 3];

function RankMock() {
  const w = 200;
  const h = 56;
  const x = (i: number) => 4 + (i * (w - 8)) / (RANKS.length - 1);
  // Position 1 at the top, 15 at the bottom.
  const y = (p: number) => 6 + ((p - 1) / 14) * (h - 12);
  const pts = RANKS.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const last = RANKS[RANKS.length - 1];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="min-w-0 truncate font-medium text-fg">eggless cake indiranagar</span>
        <span className="shrink-0 font-semibold tabular-nums text-score-good">
          #{last} <span className="font-normal text-muted">(was #{RANKS[0]})</span>
        </span>
      </div>
      <svg aria-hidden viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full">
        <line x1="0" x2={w} y1={y(1)} y2={y(1)} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="stroke-chart-grid" />
        <line x1="0" x2={w} y1={y(10)} y2={y(10)} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="stroke-chart-grid" />
        <polyline points={pts} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-chart-1" />
      </svg>
      <p className="text-[10px] text-muted">Google position, last 8 weeks</p>
    </div>
  );
}

function KeywordMock() {
  const rows = [
    { k: "eggless cake near me", vol: "8,100", d: "Easy", tone: "text-score-good" },
    { k: "custom birthday cake", vol: "4,400", d: "Medium", tone: "text-score-ok" },
    { k: "cake delivery bangalore", vol: "12,100", d: "Hard", tone: "text-score-poor" },
  ];
  return (
    <table className="w-full table-fixed text-left text-[11px]">
      <caption className="sr-only">Sample keyword ideas with monthly searches and how hard each is to rank for</caption>
      <thead>
        <tr className="border-b border-border text-[10px] text-muted">
          <th scope="col" className="w-[55%] pb-1 font-medium">Keyword</th>
          <th scope="col" className="pb-1 text-right font-medium">Searches</th>
          <th scope="col" className="pb-1 text-right font-medium">Difficulty</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k} className="border-b border-border last:border-0">
            <th scope="row" className="truncate py-1.5 font-medium text-fg">{r.k}</th>
            <td className="py-1.5 text-right tabular-nums text-fg-soft">{r.vol}</td>
            <td className={clsx("py-1.5 text-right font-medium", r.tone)}>{r.d}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompetitorsMock() {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      <p className="text-[10px] text-muted">Keywords in Google&apos;s top 10</p>
      <BarRows
        unit=""
        max={60}
        rows={[
          { label: "You", v: 38, tone: "fill-primary" },
          { label: "sweetcrumb.example", v: 52, tone: "fill-chart-muted" },
          { label: "cakebox.example", v: 21, tone: "fill-chart-muted" },
        ]}
      />
    </div>
  );
}

const LINKS_NEW = [3, 2, 4, 1, 3, 1];
const LINKS_LOST = [1, 0, 1, 0, 1, 0];

function BacklinksMock() {
  const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
  const unit = 6;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="flex items-center gap-3 text-[11px]">
        <span className="font-semibold tabular-nums text-score-good">+{sum(LINKS_NEW)} new</span>
        <span className="font-semibold tabular-nums text-score-poor">−{sum(LINKS_LOST)} lost</span>
        <span className="text-muted">this month</span>
      </p>
      <svg aria-hidden viewBox="0 0 180 56" className="h-14 w-full">
        <line x1="0" x2="180" y1="34" y2="34" vectorEffect="non-scaling-stroke" className="stroke-border" />
        {LINKS_NEW.map((n, i) => (
          <rect key={`n${i}`} x={8 + i * 29} y={34 - n * unit - 1} width="16" height={n * unit} rx="2" className="fill-score-good" />
        ))}
        {LINKS_LOST.map((n, i) =>
          n ? <rect key={`l${i}`} x={8 + i * 29} y={35} width="16" height={n * unit * 2} rx="2" className="fill-score-poor" /> : null,
        )}
      </svg>
      <p className="text-[10px] text-muted">Sites linking to you, week by week</p>
    </div>
  );
}

/* ------------------------------------------------------------------ tour */

type Tile = { key: string; title: string; line: string; mock: () => ReactNode; soon?: boolean };

function tiles(): Tile[] {
  const dfs = dfsConfigured();
  return [
    { key: "check", title: "Website check", line: "One score out of 100 for SEO, AEO and GEO, with your top fixes.", mock: ScoreMock },
    { key: "answers", title: "AI answers", line: "How often ChatGPT, Gemini, Perplexity and Claude name you.", mock: AnswersMock },
    { key: "fixes", title: "Fixes you approve", line: "A to-do list, most useful first. Nothing changes until you say yes.", mock: FixesMock },
    { key: "speed", title: "Page speed", line: "Core Web Vitals for phone and desktop, explained in plain words.", mock: SpeedMock },
    { key: "rankings", title: "Rank tracker", line: "Your Google position for each keyword, checked every week.", mock: RankMock, soon: !dfs },
    { key: "keywords", title: "Keyword research", line: "What people search, how often, and how hard it is to rank.", mock: KeywordMock, soon: !dfs },
    { key: "competitors", title: "Competitors", line: "Who shows up above you, and which searches they win.", mock: CompetitorsMock, soon: !dfs },
    { key: "backlinks", title: "Backlinks", line: "Sites that link to you, with new and lost links each month.", mock: BacklinksMock, soon: !backlinksEnabled() },
  ];
}

/**
 * Grid of mini product screens with a title and one line each. `headingAs` sets the tag for tile titles
 * (default h3, for use under a section's h2).
 */
export function ProductTour({ headingAs = "h3", className }: { headingAs?: HeadingTag; className?: string }) {
  const Heading = headingAs;
  const list = tiles();
  return (
    <figure className={clsx("relative", className)}>
      <div className="mb-4 flex justify-end">
        <SampleTag />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {list.map((t) => {
          const Mock = t.mock;
          return (
            <li key={t.key} className="flex flex-col rounded-[20px] border border-border bg-surface p-4 shadow-card sm:p-5">
              <div className="h-36 overflow-hidden rounded-xl border border-border bg-surface-2/60 p-3">
                <Mock />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Heading className="text-[1rem] font-semibold tracking-[-0.01em] text-fg">{t.title}</Heading>
                {t.soon && (
                  <span className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-[11px] font-medium text-warning">
                    Switching on soon
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-small leading-snug text-fg-soft">{t.line}</p>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-6 text-center text-small text-muted">
        Sample screens from the {BRAND.name} app: website score, AI answers, fixes, page speed, rankings, keyword ideas, competitors and backlinks.
      </figcaption>
    </figure>
  );
}
