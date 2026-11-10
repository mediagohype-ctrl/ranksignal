// One small illustration per feature on /features. Server-rendered HTML + inline SVG only (no images, no client JS).
// Every business, number and answer here is example data on .example domains, labelled "Sample".
import type { ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUp, Check, CircleAlert, RotateCcw, Search, Sparkles, Star, X } from "lucide-react";
import { ScoreRing } from "@/components/ui";
import { BarRow, Pill, Sparkline, VisualFrame, scoreTone, type Tone } from "./parts";

const YOU = "greenleaf-bakery.example";

// ------------------------------------------------------------------------------------------- Check your website

function AuditVisual() {
  const pillars = [
    { label: "SEO", score: 78 },
    { label: "AEO", score: 54 },
    { label: "GEO", score: 41 },
    { label: "Brand", score: 86 },
  ];
  return (
    <VisualFrame label={YOU} caption="Sample website check: an overall score of 65, with SEO, AEO, GEO and Brand scored from 0 to 100.">
      <div className="flex items-center gap-4">
        <ScoreRing score={65} size="md" label="Sample overall score" />
        <ul className="min-w-0 flex-1 space-y-2">
          {pillars.map((p) => (
            <BarRow key={p.label} label={p.label} value={p.score} pct={p.score} tone={scoreTone(p.score)} />
          ))}
        </ul>
      </div>
    </VisualFrame>
  );
}

function DeeperCheckVisual() {
  const rows: { label: string; result: string; tone: Tone }[] = [
    { label: "Language tags (hreflang)", result: "All good", tone: "good" },
    { label: "Insecure files", result: "3 found", tone: "poor" },
    { label: "Heavy images", result: "7 over 300 KB", tone: "ok" },
    { label: "Deep pages", result: "4 pages", tone: "ok" },
    { label: "Vague link text", result: "12 links", tone: "ok" },
  ];
  return (
    <VisualFrame label="Deeper checks" caption="Sample results from five of the deeper checks, each with a plain status.">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-fg-soft">{r.label}</span>
            <Pill tone={r.tone}>{r.result}</Pill>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function PageSpeedVisual() {
  // Segment widths follow Google's limits on a fixed scale; the marker is the sample value on that scale.
  const vitals = [
    { name: "Main content shows (LCP)", value: "2.1 s", status: "Good", tone: "good" as Tone, seg: [42, 25, 33], at: 35 },
    { name: "Reacts to a tap (INP)", value: "240 ms", status: "Needs work", tone: "ok" as Tone, seg: [25, 37, 38], at: 30 },
    { name: "Layout jumps (CLS)", value: "0.05", status: "Good", tone: "good" as Tone, seg: [25, 37, 38], at: 12 },
  ];
  return (
    <VisualFrame label="Core Web Vitals · phone" caption="Sample Core Web Vitals: each number placed on Google's good, needs-work and poor ranges.">
      <ul className="space-y-3">
        {vitals.map((v) => (
          <li key={v.name} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-fg-soft">{v.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-semibold tabular-nums text-fg">{v.value}</span>
                <Pill tone={v.tone}>{v.status}</Pill>
              </span>
            </div>
            <div aria-hidden className="relative mt-1.5 flex h-1.5 gap-0.5">
              <span className="rounded-l-full bg-score-good" style={{ width: `${v.seg[0]}%` }} />
              <span className="bg-score-ok" style={{ width: `${v.seg[1]}%` }} />
              <span className="rounded-r-full bg-score-poor" style={{ width: `${v.seg[2]}%` }} />
              <span className="absolute -top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-bg bg-fg" style={{ left: `${v.at}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function InternalLinksVisual() {
  return (
    <VisualFrame label="Internal links" caption="Sample suggestion: link a nearly cut-off page from a page that already mentions its topic.">
      <svg aria-hidden viewBox="0 0 240 92" className="block h-auto w-full">
        <g className="stroke-chart-grid" strokeWidth={2}>
          <line x1={120} y1={16} x2={50} y2={52} />
          <line x1={120} y1={16} x2={120} y2={52} />
          <line x1={120} y1={16} x2={190} y2={52} />
          <line x1={50} y1={52} x2={120} y2={52} />
        </g>
        <path d="M54 58 Q 80 92 186 78" fill="none" className="stroke-primary" strokeWidth={2} strokeDasharray="5 4" />
        <circle cx={120} cy={16} r={10} className="fill-chart-1" />
        <circle cx={50} cy={52} r={8} className="fill-chart-2" />
        <circle cx={120} cy={52} r={8} className="fill-chart-muted" />
        <circle cx={190} cy={52} r={8} className="fill-chart-muted" />
        <circle cx={196} cy={80} r={8} className="fill-bg stroke-score-poor" strokeWidth={2} strokeDasharray="3 2" />
      </svg>
      <ul className="mt-2 space-y-1 text-xs text-fg-soft">
        <li className="flex justify-between gap-2">
          <span>/eggless-cakes</span>
          <Pill tone="poor">linked from 1 page</Pill>
        </li>
        <li className="rounded-lg bg-primary-soft px-2.5 py-1.5 text-primary-soft-fg">
          Suggest: on /blog/party-ideas, link the words “eggless birthday cakes” to /eggless-cakes
        </li>
      </ul>
    </VisualFrame>
  );
}

function RecommendationsVisual() {
  const todos: { text: string; impact: string; tone: Tone; time: string }[] = [
    { text: "Add opening hours to the contact page", impact: "High help", tone: "good", time: "10 min" },
    { text: "Answer “Do you deliver on Sundays?”", impact: "High help", tone: "good", time: "20 min" },
    { text: "Shorten the home page title", impact: "Some help", tone: "ok", time: "5 min" },
  ];
  return (
    <VisualFrame label="To-do list" caption="Sample to-do list: each fix shows how much it helps and how long it takes.">
      <ol className="space-y-2">
        {todos.map((t, i) => (
          <li key={t.text} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <p className="font-medium text-fg">
              <span className="mr-1.5 tabular-nums text-muted">{i + 1}.</span>
              {t.text}
            </p>
            <p className="mt-1.5 flex gap-1.5">
              <Pill tone={t.tone}>{t.impact}</Pill>
              <Pill>{t.time}</Pill>
            </p>
          </li>
        ))}
      </ol>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- Get found by AI

function PromptResearchVisual() {
  const qs: { intent: string; tone: Tone; q: string }[] = [
    { intent: "Learn", tone: "neutral", q: "Is eggless cake as soft as regular cake?" },
    { intent: "Compare", tone: "ok", q: "Best bakery in Indiranagar for custom cakes" },
    { intent: "Buy", tone: "good", q: "Order an eggless birthday cake for today" },
  ];
  return (
    <VisualFrame label="Customer questions" caption="Sample customer questions, grouped by what the customer wants to do.">
      <ul className="space-y-2">
        {qs.map((x) => (
          <li key={x.q} className="flex items-start gap-2 rounded-xl rounded-tl-sm bg-surface-2 px-3 py-2 text-xs text-fg">
            <Pill tone={x.tone} className="mt-px">
              {x.intent}
            </Pill>
            <span className="min-w-0">{x.q}</span>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function VisibilityVisual() {
  const rows = [
    { name: "Perplexity", n: 11 },
    { name: "ChatGPT", n: 9 },
    { name: "Gemini", n: 6 },
    { name: "Claude", n: 5 },
    { name: "Grok", n: 3 },
  ];
  return (
    <VisualFrame label="Named in AI answers" caption="Sample: how many of 20 answers from each AI assistant named the business.">
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <BarRow key={r.name} label={r.name} value={`${r.n} of 20`} pct={(r.n / 20) * 100} tone="primary" />
        ))}
      </ul>
    </VisualFrame>
  );
}

function AiOverviewsVisual() {
  return (
    <VisualFrame label="Google search" caption="Sample Google AI Overview that names and links the business, as we record it.">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg">
        <Search aria-hidden size={13} className="shrink-0 text-muted" />
        <span className="truncate">eggless cake delivery indiranagar</span>
      </div>
      <div className="mt-2.5 rounded-xl border border-primary/25 bg-primary-soft/50 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-semibold text-fg">
          <Sparkles aria-hidden size={13} className="text-primary" />
          AI Overview
        </p>
        <p className="mt-1.5 leading-snug text-fg-soft">
          <mark className="rounded bg-primary-soft px-1 font-semibold text-primary-soft-fg">Greenleaf Bakery</mark> offers
          same-day eggless cakes across Indiranagar and Domlur…
        </p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          <Pill tone="primary">{YOU}</Pill>
          <Pill>bangalore-eats.example</Pill>
        </p>
      </div>
      <p className="mt-2 text-xs text-fg-soft">
        Named in <strong className="text-fg">4 of 10</strong> AI Overviews this week
      </p>
    </VisualFrame>
  );
}

function CitationsVisual() {
  const rows = [
    { d: "bangalore-eats.example", n: 14 },
    { d: YOU, n: 9, you: true },
    { d: "sweetcrumbs.example", n: 7 },
    { d: "food-guide.example", n: 5 },
  ];
  return (
    <VisualFrame label="Websites AI links to" caption="Sample: how many AI answers linked to each website, with your site highlighted.">
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <BarRow
            key={r.d}
            label={r.you ? `${r.d} (you)` : r.d}
            value={`${r.n} links`}
            pct={(r.n / 14) * 100}
            tone={r.you ? "primary" : "neutral"}
            strong={r.you}
          />
        ))}
      </ul>
    </VisualFrame>
  );
}

function CompetitorShareVisual() {
  const parts = [
    { name: "sweetcrumbs.example", pct: 41, cls: "bg-chart-3" },
    { name: "You", pct: 34, cls: "bg-chart-1" },
    { name: "cakeworld.example", pct: 25, cls: "bg-chart-2" },
  ];
  return (
    <VisualFrame label="Share of AI mentions" caption="Sample share of AI mentions: you against two competitors you chose.">
      <div aria-hidden className="flex h-4 overflow-hidden rounded-full">
        {parts.map((p) => (
          <span key={p.name} className={p.cls} style={{ width: `${p.pct}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-2">
            <span className={clsx("flex min-w-0 items-center gap-2", p.name === "You" ? "font-semibold text-fg" : "text-fg-soft")}>
              <span aria-hidden className={clsx("size-2.5 shrink-0 rounded-sm", p.cls)} />
              <span className="truncate">{p.name}</span>
            </span>
            <span className="tabular-nums text-fg">{p.pct}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-soft">Based on 120 AI answers</p>
    </VisualFrame>
  );
}

function AiCrawlersVisual() {
  const rows = [
    { bot: "Googlebot (Google)", n: 1240 },
    { bot: "Bingbot (Bing, Copilot)", n: 410 },
    { bot: "GPTBot (OpenAI)", n: 312 },
    { bot: "ClaudeBot (Anthropic)", n: 140 },
    { bot: "PerplexityBot", n: 96 },
  ];
  return (
    <VisualFrame label="Robot visits · last 30 days" caption="Sample robot visits over 30 days, from search engines and AI companies.">
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <BarRow key={r.bot} label={r.bot} value={r.n.toLocaleString("en-IN")} pct={(r.n / 1240) * 100} tone={i < 2 ? "neutral" : "primary"} />
        ))}
      </ul>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- Fix safely

function PublishingVisual() {
  return (
    <VisualFrame label="Home page title" caption="Sample fix: the exact change shown before it goes live, with approve and undo.">
      <div className="space-y-1.5 text-xs">
        <p className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-fg-soft">
          <span className="mr-1.5 font-semibold text-danger">Before</span>
          <del>Home</del>
        </p>
        <p className="rounded-lg bg-success-soft px-2.5 py-1.5 text-fg">
          <span className="mr-1.5 font-semibold text-success">After</span>
          <ins className="no-underline">Eggless Cakes in Indiranagar | Greenleaf Bakery</ins>
        </p>
      </div>
      <div aria-hidden className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-primary-fg">
          <Check size={13} /> Approve
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-fg-soft">
          <RotateCcw size={13} /> Undo
        </span>
      </div>
      <p className="mt-2 text-xs text-fg-soft">Needs your OK · old version saved</p>
    </VisualFrame>
  );
}

function ConnectorsVisual() {
  const items: { name: string; how: string }[] = [
    { name: "WordPress", how: "Publishes" },
    { name: "GitHub", how: "Pull request" },
    { name: "Shopify", how: "Drafts" },
    { name: "Webflow", how: "Drafts" },
    { name: "Contentful", how: "Drafts" },
    { name: "Sanity", how: "Drafts" },
    { name: "Wix", how: "Drafts" },
    { name: "Any website", how: "Copy steps" },
  ];
  return (
    <VisualFrame label="Where fixes can go" sample={false} caption="The website platforms we connect to, and how each one receives a fix.">
      <ul className="grid grid-cols-2 gap-1.5">
        {items.map((it) => (
          <li key={it.name} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs">
            <span className="block font-medium text-fg">{it.name}</span>
            <span className="block text-[11px] text-muted">{it.how}</span>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function IndexNowVisual() {
  const steps = [
    { title: "Page changed", sub: "/eggless-cakes" },
    { title: "Sent with IndexNow", sub: "1 page, just now" },
    { title: "Search engines told", sub: "Bing, Yandex, Naver, Seznam" },
  ];
  return (
    <VisualFrame label="IndexNow" caption="Sample: a changed page is sent with IndexNow and the search engines accept it.">
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.title}>
            <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
              <span className="block font-medium text-fg">{s.title}</span>
              <span className="block text-[11px] text-muted">{s.sub}</span>
            </div>
            {i < steps.length - 1 && <ArrowDown aria-hidden size={14} className="mx-auto my-0.5 text-muted" />}
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-soft">
        <Pill tone="good">Accepted</Pill> Google isn&apos;t part of IndexNow
      </p>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- Track Google

function RankTrackerVisual() {
  const history = [18, 15, 14, 11, 9, 8, 6, 5];
  const rows = [
    { k: "eggless cake indiranagar", pos: 5, move: 1 },
    { k: "birthday cake delivery", pos: 12, move: 3 },
    { k: "bakery near me", pos: 21, move: -2 },
  ];
  return (
    <VisualFrame label="Google position" caption="Sample rank history: position 18 to 5 over eight weeks for one search.">
      <svg
        role="img"
        aria-label={`Sample: Google position for eggless cake indiranagar over 8 weeks: ${history.join(", ")}.`}
        viewBox="0 0 240 64"
        className="block h-auto w-full"
      >
        <SparkInner values={history} />
      </svg>
      <ul className="mt-2 divide-y divide-border text-xs">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0 truncate text-fg-soft">{r.k}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              <span className="font-semibold text-fg">#{r.pos}</span>
              <Move n={r.move} />
            </span>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

/** Line for the rank chart: low positions drawn at the top. */
function SparkInner({ values }: { values: number[] }) {
  const w = 240;
  const h = 64;
  const pad = 6;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), pad + ((v - min) / span) * (h - pad * 2)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <>
      {[16, 32, 48].map((y) => (
        <line key={y} x1={0} x2={w} y1={y} y2={y} className="stroke-chart-grid" strokeWidth={1} />
      ))}
      <path d={d} fill="none" className="stroke-chart-1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} className="fill-chart-1" />
    </>
  );
}

function Move({ n }: { n: number }) {
  if (n === 0) return <span className="text-muted">–</span>;
  const up = n > 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5", up ? "text-score-good" : "text-score-poor")}>
      {up ? <ArrowUp aria-hidden size={12} /> : <ArrowDown aria-hidden size={12} />}
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.abs(n)}
    </span>
  );
}

function KeywordResearchVisual() {
  const rows: { k: string; vol: string; diff: string; tone: Tone }[] = [
    { k: "eggless cake near me", vol: "2,900", diff: "Easy", tone: "good" },
    { k: "birthday cake delivery bangalore", vol: "1,600", diff: "Medium", tone: "ok" },
    { k: "photo cake online", vol: "8,100", diff: "Hard", tone: "poor" },
  ];
  return (
    <VisualFrame label="Keyword ideas" caption="Sample keyword ideas with monthly Google searches and how hard each one is.">
      <table className="w-full table-fixed text-left text-xs">
        <thead className="text-[11px] text-muted">
          <tr>
            <th scope="col" className="pb-1.5 font-medium">Search</th>
            <th scope="col" className="w-18 pb-1.5 text-right font-medium">A month</th>
            <th scope="col" className="w-17 pb-1.5 text-right font-medium">Difficulty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.k}>
              <td className="truncate py-1.5 pr-2 text-fg-soft">{r.k}</td>
              <td className="py-1.5 text-right tabular-nums text-fg">{r.vol}</td>
              <td className="py-1.5 text-right">
                <Pill tone={r.tone}>{r.diff}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-fg-soft">
        Google&apos;s top 10 today: 4 shops, 3 guides, 2 directories, 1 map pack · AI Overview shown
      </p>
    </VisualFrame>
  );
}

function CompetitorResearchVisual() {
  const rows = [
    { d: "sweetcrumbs.example", n: 4800 },
    { d: YOU, n: 2100, you: true },
    { d: "cakeworld.example", n: 1300 },
  ];
  return (
    <VisualFrame label="Estimated Google visits a month" caption="Sample traffic estimates for three bakeries, plus the keyword gap.">
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <BarRow
            key={r.d}
            label={r.you ? `${r.d} (you)` : r.d}
            value={`~${r.n.toLocaleString("en-IN")}`}
            pct={(r.n / 4800) * 100}
            tone={r.you ? "primary" : "neutral"}
            strong={r.you}
          />
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-fg-soft">
        Keyword gap: <strong className="text-fg">37 searches</strong> where sweetcrumbs.example shows on Google and you don&apos;t
      </p>
    </VisualFrame>
  );
}

function BacklinksVisual() {
  const rows: { d: string; status: string; tone: Tone }[] = [
    { d: "bangalore-eats.example", status: "New", tone: "good" },
    { d: "party-planner.example", status: "New", tone: "good" },
    { d: "old-directory.example", status: "Lost", tone: "poor" },
  ];
  return (
    <VisualFrame label="Links to your website" caption="Sample backlinks: new and lost links since the last check, and the link gap.">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <p className="rounded-lg bg-score-good-soft px-2.5 py-1.5 text-score-good">
          <span className="block text-base font-semibold tabular-nums">+6</span>new links
        </p>
        <p className="rounded-lg bg-score-poor-soft px-2.5 py-1.5 text-score-poor">
          <span className="block text-base font-semibold tabular-nums">−2</span>lost links
        </p>
      </div>
      <ul className="mt-2 divide-y divide-border text-xs">
        {rows.map((r) => (
          <li key={r.d} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0 truncate text-fg-soft">{r.d}</span>
            <Pill tone={r.tone}>{r.status}</Pill>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-fg-soft">
        Link gap: <strong className="text-fg">12 sites</strong> link to competitors, not to you
      </p>
    </VisualFrame>
  );
}

function BusinessProfileVisual() {
  const checks = [
    { label: "Opening hours", ok: true },
    { label: "Photos", ok: true },
    { label: "Website link", ok: true },
    { label: "Business description", ok: false },
    { label: "Address matches your website", ok: true },
  ];
  return (
    <VisualFrame label="Google Maps listing" caption="Sample Business Profile snapshot: rating, reviews and a completeness checklist.">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <p className="min-w-0 truncate text-xs font-semibold text-fg">Greenleaf Bakery</p>
        <p className="flex shrink-0 items-center gap-1 text-xs text-fg">
          <Star aria-hidden size={13} className="fill-current text-score-ok" />
          <span className="font-semibold tabular-nums">4.6</span>
          <span className="text-muted">(128 reviews)</span>
        </p>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-fg-soft">
            {c.ok ? (
              <Check aria-hidden size={13} className="shrink-0 text-score-good" />
            ) : (
              <X aria-hidden size={13} className="shrink-0 text-score-poor" />
            )}
            <span className="min-w-0 truncate">{c.label}</span>
            <span className="sr-only">{c.ok ? ": done" : ": missing"}</span>
            {!c.ok && <Pill tone="poor" className="ml-auto">Missing</Pill>}
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- Reports, alerts, language

function ReportsVisual() {
  const scores = [58, 59, 61, 60, 63, 65];
  return (
    <VisualFrame label="October report" caption="Sample monthly report: overall score from 58 to 65 over six months, and fixes made.">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-soft">Overall score</span>
        <span className="tabular-nums">
          <strong className="text-base text-fg">65</strong> <span className="text-score-good">+2 this month</span>
        </span>
      </div>
      <Sparkline values={scores} className="mt-1" />
      <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <li className="rounded-lg bg-surface-2 px-2.5 py-1.5">
          <span className="block text-base font-semibold tabular-nums text-fg">6</span>
          <span className="text-fg-soft">fixes made</span>
        </li>
        <li className="rounded-lg bg-surface-2 px-2.5 py-1.5">
          <span className="block text-base font-semibold tabular-nums text-fg">240</span>
          <span className="text-fg-soft">AI answers read</span>
        </li>
      </ul>
    </VisualFrame>
  );
}

function AlertsVisual() {
  const alerts: { text: string; when: string; tone: Tone; level: string }[] = [
    { text: "Website can't be reached — 2 checks in a row", when: "Just now", tone: "poor", level: "Urgent" },
    { text: "Overall score dropped 6 points", when: "Today", tone: "ok", level: "Warning" },
    { text: "ChatGPT now names you for “eggless cake Indiranagar”", when: "Yesterday", tone: "neutral", level: "Info" },
  ];
  return (
    <VisualFrame label="Alerts" caption="Sample alerts, from urgent to good news, sent in the app, by email or on WhatsApp.">
      <ul className="space-y-1.5">
        {alerts.map((a) => (
          <li key={a.text} className="flex gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <CircleAlert aria-hidden size={14} className={clsx("mt-px shrink-0", a.tone === "poor" ? "text-score-poor" : a.tone === "ok" ? "text-score-ok" : "text-primary")} />
            <span className="min-w-0">
              <span className="block font-medium text-fg">{a.text}</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                {a.level} · {a.when}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-1.5">
        <Pill tone="primary">In app</Pill>
        <Pill tone="primary">Email</Pill>
        <Pill tone="primary">WhatsApp</Pill>
      </p>
    </VisualFrame>
  );
}

function LocalesVisual() {
  const sites = [
    { site: YOU, market: "India · English", q: "Best eggless cake shop in Bengaluru" },
    { site: "greenleaf-dubai.example", market: "UAE · English", q: "Eggless birthday cake delivery in Dubai" },
  ];
  return (
    <VisualFrame label="Markets" caption="Sample: two websites, each with questions written for its own country.">
      <ul className="space-y-2">
        {sites.map((s) => (
          <li key={s.site} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
            <p className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-fg">{s.site}</span>
              <Pill tone="primary">{s.market}</Pill>
            </p>
            <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-fg-soft">“{s.q}”</p>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function HindiVisual() {
  return (
    <VisualFrame label="English · हिन्दी" sample={false} caption="The same free website checker, in English and in Hindi.">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div lang="en" className="rounded-xl border border-border bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">English</p>
          <p className="mt-1.5 font-semibold leading-snug text-fg">Free SEO, AEO and GEO website checker</p>
          <p className="mt-1 text-fg-soft">Check. Fix. Grow.</p>
        </div>
        <div lang="hi" className="rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
          <p className="text-[11px] font-medium text-muted">हिन्दी</p>
          <p className="mt-1.5 font-semibold leading-snug text-fg">फ्री SEO, AEO और GEO वेबसाइट चेकर</p>
          <p className="mt-1 text-fg-soft">चेक करें। सुधारें। आगे बढ़ें।</p>
        </div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-fg-soft">
        <span>EN</span>
        <ArrowRight aria-hidden size={13} />
        <span lang="hi">हिं</span>
        <span className="text-muted">· switch from the top of the page</span>
      </p>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- Agencies & developers

function ReportBuilderVisual() {
  const rows = [
    { site: YOU, score: 65, move: 4 },
    { site: "smile-dental-pune.example", score: 72, move: 2 },
    { site: "lotus-yoga.example", score: 48, move: -3 },
  ];
  return (
    <VisualFrame label="Portfolio" caption="Sample portfolio: three client websites with their score and change, and report sections.">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-xs">
        {rows.map((r) => (
          <li key={r.site} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0 truncate text-fg-soft">{r.site}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              <Pill tone={scoreTone(r.score)}>{r.score}</Pill>
              <Move n={r.move} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Report sections</p>
      <p className="mt-1.5 flex flex-wrap gap-1.5">
        {["Summary", "Scores", "Fixes done", "AI mentions", "Page speed"].map((s) => (
          <Pill key={s}>{s}</Pill>
        ))}
      </p>
    </VisualFrame>
  );
}

function DeveloperApiVisual() {
  return (
    <VisualFrame label="Public API" caption="Sample API request for a website's score history, and the three ways to connect.">
      <pre className="overflow-x-auto rounded-xl bg-fg px-3 py-2.5 font-mono text-[11px] leading-relaxed text-bg">
        <code>
          {`GET /api/v1/projects/{id}/scores

{ "data": [{
    "overallScore": 65,
    "pillarScores": {
      "seo": 78, "aeo": 54,
      "geo": 41, "brand": 86 }
}] }`}
        </code>
      </pre>
      <p className="mt-2.5 flex flex-wrap gap-1.5">
        <Pill tone="primary">REST API</Pill>
        <Pill tone="primary">MCP server</Pill>
        <Pill tone="primary">Looker Studio</Pill>
      </p>
    </VisualFrame>
  );
}

// ------------------------------------------------------------------------------------------- lookup

const VISUALS: Record<string, () => ReactNode> = {
  audit: AuditVisual,
  "deeper-check": DeeperCheckVisual,
  "page-speed": PageSpeedVisual,
  "internal-links": InternalLinksVisual,
  recommendations: RecommendationsVisual,
  "prompt-research": PromptResearchVisual,
  "visibility-tracking": VisibilityVisual,
  "ai-overviews": AiOverviewsVisual,
  "citation-tracking": CitationsVisual,
  "competitor-share": CompetitorShareVisual,
  "ai-crawlers": AiCrawlersVisual,
  publishing: PublishingVisual,
  connectors: ConnectorsVisual,
  indexnow: IndexNowVisual,
  "rank-tracker": RankTrackerVisual,
  "keyword-research": KeywordResearchVisual,
  "competitor-research": CompetitorResearchVisual,
  backlinks: BacklinksVisual,
  "business-profile": BusinessProfileVisual,
  reports: ReportsVisual,
  alerts: AlertsVisual,
  locales: LocalesVisual,
  hindi: HindiVisual,
  "report-builder": ReportBuilderVisual,
  "developer-api": DeveloperApiVisual,
};

/** Slugs that have an illustration (tests can assert every feature is covered). */
export const ILLUSTRATED_SLUGS = Object.keys(VISUALS);

/** The illustration for one feature, or nothing if none exists for that slug. */
export function FeatureIllustration({ slug }: { slug: string }) {
  const Visual = VISUALS[slug];
  return Visual ? <Visual /> : null;
}
