// Small decorative illustrations for the Check → Fix → Grow steps. Shapes only (no words), aria-hidden: the step's
// title and text beside each one already say what it shows.
import clsx from "clsx";
import { Check, Quote, Search, Sparkles } from "lucide-react";

const FRAME = "block h-24 w-full rounded-xl border border-border bg-surface shadow-card";

/** Check: a web page being read under a magnifying glass. */
function CheckArt() {
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      <rect x="16" y="14" width="132" height="68" rx="6" className="fill-surface-2 stroke-border" />
      <circle cx="26" cy="23" r="2.5" className="fill-chart-muted" />
      <circle cx="34" cy="23" r="2.5" className="fill-chart-muted" />
      <rect x="26" y="36" width="78" height="6" rx="3" className="fill-chart-muted" />
      <rect x="26" y="49" width="104" height="4" rx="2" className="fill-surface-3" />
      <rect x="26" y="59" width="92" height="4" rx="2" className="fill-surface-3" />
      <rect x="26" y="69" width="60" height="4" rx="2" className="fill-surface-3" />
      <circle cx="150" cy="50" r="22" strokeWidth="5" className="fill-primary-soft/60 stroke-primary" />
      <line x1="166" y1="66" x2="184" y2="84" strokeWidth="7" strokeLinecap="round" className="stroke-primary" />
      <circle cx="212" cy="30" r="15" strokeWidth="4" className="fill-none stroke-score-track" />
      <circle cx="212" cy="30" r="15" strokeWidth="4" strokeDasharray="48 94" strokeLinecap="round" transform="rotate(-90 212 30)" className="fill-none stroke-score-ok" />
    </svg>
  );
}

/** Fix: a short to-do list with the first item ticked. */
function FixArt() {
  const rows = [22, 44, 66];
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      {rows.map((y, i) => (
        <g key={y}>
          <rect x="20" y={y - 8} width="16" height="16" rx="4" strokeWidth="2" className={i === 0 ? "fill-score-good stroke-score-good" : "fill-surface stroke-border-strong"} />
          {i === 0 && <path d={`M24 ${y} l3.5 3.5 l6 -7`} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-fg" />}
          <rect x="46" y={y - 3} width={[104, 120, 88][i]} height="6" rx="3" className={i === 0 ? "fill-surface-3" : "fill-chart-muted"} />
          <rect x="184" y={y - 7} width="36" height="14" rx="7" className="fill-score-good-soft" />
          <rect x="192" y={y - 1.5} width="20" height="3" rx="1.5" className="fill-score-good" />
        </g>
      ))}
    </svg>
  );
}

/** Grow: monthly bars climbing, with a trend line. */
function GrowArt() {
  const bars = [26, 34, 40, 52, 60, 72];
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      <line x1="16" x2="224" y1="84" y2="84" className="stroke-border" />
      {bars.map((h, i) => (
        <rect key={i} x={24 + i * 34} y={84 - h} width="22" height={h} rx="4" className={i === bars.length - 1 ? "fill-primary" : "fill-primary-soft"} />
      ))}
      <polyline
        points={bars.map((h, i) => `${35 + i * 34},${84 - h - 6}`).join(" ")}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-score-good"
      />
    </svg>
  );
}

const ART = { Check: CheckArt, Fix: FixArt, Grow: GrowArt } as const;


export function StepArt({ step, className }: { step: string; className?: string }) {
  const Art = ART[step as keyof typeof ART];
  if (!Art) return null;
  return (
    <div aria-hidden className={clsx(className)}>
      <Art />
    </div>
  );
}

/* ------------------------------------------------------------------ the three places customers look (SEO/AEO/GEO) */
// Tiny, realistic mock-ups with real words, so anyone gets it at a glance: "Your business" on Google, quoted in
// Google's answer box, and named by ChatGPT. Decorative (aria-hidden): the card's own words say the same thing.

const TILE = "flex h-36 flex-col gap-2 overflow-hidden rounded-xl bg-surface-2/80 p-3 text-[11px] leading-tight";

function SearchBar({ query }: { query: string }) {
  return (
    <div className="flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-fg-soft">
      <Search size={11} className="shrink-0 text-muted" />
      <span className="truncate">{query}</span>
    </div>
  );
}

/** SEO: Google results — your business is result #1. */
function SeoMock() {
  return (
    <div className={TILE}>
      <SearchBar query="cake shop near me" />
      <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-2 py-1.5 ring-1 ring-primary/30">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-fg">1</span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-primary-soft-fg">Your business</span>
          <span className="block truncate text-[10px] text-primary-soft-fg/80">Fresh cakes, same-day delivery</span>
        </span>
      </div>
      {["Other bakery", "Another shop"].map((n, i) => (
        <div key={n} className="flex items-center gap-2 px-2 text-muted">
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold">{i + 2}</span>
          <span className="truncate">{n}</span>
        </div>
      ))}
    </div>
  );
}

/** AEO: Google answers the question itself, at the top, quoting your page. */
function AeoMock() {
  return (
    <div className={TILE}>
      <SearchBar query="do they deliver on Sunday?" />
      <div className="rounded-lg border-l-4 border-primary bg-surface px-2.5 py-2 shadow-xs">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">
          <Quote size={10} /> Answer
        </p>
        <p className="mt-1 text-fg">“Yes, open 9 am – 9 pm, all 7 days.”</p>
        <p className="mt-1 truncate text-[10px] font-semibold text-primary">— from Your business</p>
      </div>
      <div className="px-1 text-muted">
        <span className="block h-1.5 w-3/4 rounded-full bg-surface-3" />
      </div>
    </div>
  );
}

/** GEO: the customer asks ChatGPT, it names 3 businesses — and yours is one of them. */
function GeoMock() {
  return (
    <div className={TILE}>
      <p className="ml-auto max-w-[85%] truncate rounded-2xl rounded-br-sm bg-fg px-2.5 py-1 text-bg">Which cake shop should I pick?</p>
      <div className="flex gap-1.5">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Sparkles size={11} />
        </span>
        <ol className="min-w-0 flex-1 space-y-1 rounded-2xl rounded-tl-sm border border-border bg-surface px-2.5 py-1.5 text-fg-soft">
          <li className="truncate">1. Other bakery</li>
          <li className="flex items-center gap-1 rounded-md bg-primary-soft px-1 font-semibold text-primary-soft-fg">
            <span className="truncate">2. Your business</span>
            <Check size={11} className="ml-auto shrink-0 text-score-good" />
          </li>
          <li className="truncate">3. Another shop</li>
        </ol>
      </div>
    </div>
  );
}

const PLACE_ART = { SEO: SeoMock, AEO: AeoMock, GEO: GeoMock } as const;

/** The picture at the top of each "where customers look" card. */
export function PlaceArt({ place, className }: { place: string; className?: string }) {
  const Art = PLACE_ART[place as keyof typeof PLACE_ART];
  if (!Art) return null;
  return (
    <div aria-hidden className={clsx(className)}>
      <Art />
    </div>
  );
}
