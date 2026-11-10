// Tiny, decorative previews of what each free tool gives back, for the /tools hub cards. Server component, plain HTML.
// Decorative only (aria-hidden): each card's title and text say what the tool does. Fixed height, so no layout shift.
import clsx from "clsx";
import { Check, Minus, X } from "lucide-react";

export type ToolPreviewKind =
  | "score"
  | "meta"
  | "headings"
  | "schema"
  | "links"
  | "extension"
  | "ai"
  | "crawlers"
  | "robots"
  | "sitemap"
  | "llms"
  | "titles"
  | "descriptions"
  | "faq"
  | "faq-code";

const box = "h-24 overflow-hidden rounded-xl border border-border bg-surface-2/60 p-3 text-[11px] leading-snug text-fg-soft";
const mono = "font-mono text-[10.5px]";
const ok = <Check size={12} strokeWidth={2.75} className="shrink-0 text-score-good" />;
const bad = <X size={12} strokeWidth={2.75} className="shrink-0 text-score-poor" />;
const warn = <Minus size={12} strokeWidth={2.75} className="shrink-0 text-score-ok" />;

function Pill({ tone, children }: { tone: "good" | "ok" | "poor"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[9.5px] font-semibold tabular-nums",
        tone === "good" ? "bg-score-good-soft text-score-good" : tone === "ok" ? "bg-score-ok-soft text-score-ok" : "bg-score-poor-soft text-score-poor",
      )}
    >
      {children}
    </span>
  );
}

function Row({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
    </span>
  );
}

export function ToolPreview({ kind, className }: { kind: ToolPreviewKind; className?: string }) {
  return (
    <div aria-hidden className={clsx(box, className)}>
      <Body kind={kind} />
    </div>
  );
}

function Body({ kind }: { kind: ToolPreviewKind }) {
  switch (kind) {
    case "score": {
      const r = 22;
      const c = 2 * Math.PI * r;
      return (
        <div className="flex h-full items-center gap-3">
          <svg viewBox="0 0 56 56" className="size-[4.25rem] shrink-0 -rotate-90">
            <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-score-track" />
            <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.38} className="stroke-score-ok" />
          </svg>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            {(["SEO", "AEO", "GEO"] as const).map((p, i) => (
              <span key={p} className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 font-semibold text-fg">{p}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-score-track">
                  <span className={clsx("block h-full rounded-full", ["w-[78%] bg-score-good", "w-[55%] bg-score-ok", "w-[40%] bg-score-poor"][i])} />
                </span>
              </span>
            ))}
          </span>
        </div>
      );
    }
    case "meta":
      return (
        <span className="flex h-full flex-col gap-1">
          <span className="truncate text-[10px] text-score-good">yourbusiness.example</span>
          <span className="truncate text-[12px] font-semibold text-primary">Fresh Cakes in Indiranagar · Your Business</span>
          <span className="line-clamp-2 text-[10.5px] text-muted">Eggless and custom cakes, baked to order with same-day delivery.</span>
          <span className="mt-auto flex gap-1.5">
            <Pill tone="good">Title 44 / 60</Pill>
            <Pill tone="ok">Summary short</Pill>
          </span>
        </span>
      );
    case "headings":
      return (
        <span className={clsx("flex h-full flex-col gap-1", mono)}>
          <Row icon={ok}>
            <b className="text-fg">H1</b> Fresh cakes in Indiranagar
          </Row>
          <Row icon={ok}>
            <span className="pl-3">
              <b className="text-fg">H2</b> Our cakes
            </span>
          </Row>
          <Row icon={warn}>
            <span className="pl-6">
              <b className="text-fg">H4</b> Delivery (skips H3)
            </span>
          </Row>
          <Row icon={ok}>
            <span className="pl-3">
              <b className="text-fg">H2</b> Order online
            </span>
          </Row>
        </span>
      );
    case "schema":
      return (
        <span className={clsx("flex h-full flex-col gap-0.5", mono)}>
          <span className="text-fg">{"{ \"@type\": \"LocalBusiness\","}</span>
          <Row icon={ok}>name, address, telephone</Row>
          <Row icon={ok}>openingHours</Row>
          <Row icon={bad} right={<Pill tone="poor">Missing</Pill>}>
            priceRange
          </Row>
        </span>
      );
    case "links":
      return (
        <span className="flex h-full flex-col gap-1">
          <Row icon={ok} right={<Pill tone="good">200</Pill>}>/menu</Row>
          <Row icon={warn} right={<Pill tone="ok">301</Pill>}>/old-offers</Row>
          <Row icon={bad} right={<Pill tone="poor">404</Pill>}>/cakes/summer-special</Row>
          <Row icon={ok} right={<Pill tone="good">200</Pill>}>/contact</Row>
        </span>
      );
    case "extension":
      return (
        <span className="flex h-full flex-col gap-2">
          <span className="flex h-6 items-center gap-1.5 rounded-md border border-border bg-surface px-2">
            <span className="size-1.5 rounded-full bg-border-strong" />
            <span className="size-1.5 rounded-full bg-border-strong" />
            <span className="min-w-0 flex-1 truncate text-muted">any-website.example/page</span>
            <span className="inline-flex size-4 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-fg">M</span>
          </span>
          <span className="ml-auto flex w-[70%] flex-col gap-1 rounded-md border border-border bg-surface p-1.5">
            <Row icon={ok}>Title and summary</Row>
            <Row icon={warn}>2 H1 headings</Row>
          </span>
        </span>
      );
    case "ai":
      return (
        <span className="flex h-full flex-col justify-center gap-1.5">
          <span className="ml-auto max-w-[85%] truncate rounded-lg rounded-tr-sm bg-surface-3 px-2 py-1 text-fg">Best cake shop near me?</span>
          <span className="max-w-[95%] rounded-lg rounded-tl-sm bg-surface px-2 py-1">
            Try <mark className="rounded bg-primary-soft px-1 font-semibold text-primary-soft-fg">Your Business</mark>, open till 9 pm.
          </span>
        </span>
      );
    case "crawlers":
      return (
        <span className="grid h-full grid-cols-2 content-start gap-x-3 gap-y-1">
          {(
            [
              ["GPTBot", true],
              ["ClaudeBot", true],
              ["PerplexityBot", true],
              ["Google-Extended", false],
              ["Googlebot", true],
              ["CCBot", false],
            ] as const
          ).map(([b, allowed]) => (
            <Row key={b} icon={allowed ? ok : bad}>
              {b}
            </Row>
          ))}
        </span>
      );
    case "robots":
      return (
        <span className={clsx("flex h-full flex-col gap-0.5", mono)}>
          <span>User-agent: *</span>
          <span>Disallow: /admin/</span>
          <span className="mt-auto flex items-center gap-1.5 font-sans">
            <span className="min-w-0 flex-1 truncate">/menu for Googlebot</span>
            <Pill tone="good">Allowed</Pill>
          </span>
          <span className="flex items-center gap-1.5 font-sans">
            <span className="min-w-0 flex-1 truncate">/admin/ for GPTBot</span>
            <Pill tone="poor">Blocked</Pill>
          </span>
        </span>
      );
    case "sitemap":
      return (
        <span className={clsx("flex h-full flex-col gap-0.5", mono)}>
          <span className="text-fg">sitemap.xml</span>
          <Row icon={ok}>
            <span className="pl-2">/</span>
          </Row>
          <Row icon={ok}>
            <span className="pl-2">/menu</span>
          </Row>
          <Row icon={bad} right={<Pill tone="poor">404</Pill>}>
            <span className="pl-2">/old-page</span>
          </Row>
        </span>
      );
    case "llms":
      return (
        <span className={clsx("flex h-full flex-col gap-0.5", mono)}>
          <span className="font-semibold text-fg">llms.txt</span>
          <span># Your Business</span>
          <span className="truncate text-muted">&gt; Bakery in Indiranagar, Bengaluru</span>
          <span className="truncate">- [Menu](/menu): cakes and prices</span>
        </span>
      );
    case "titles":
      return (
        <span className="flex h-full flex-col gap-1">
          {(
            [
              ["Eggless Cakes in Indiranagar · Your Business", "52"],
              ["Same-Day Cake Delivery in Bengaluru", "35"],
              ["Custom Birthday Cakes, Baked to Order", "37"],
            ] as const
          ).map(([t, n]) => (
            <Row key={t} right={<Pill tone="good">{n}</Pill>}>
              {t}
            </Row>
          ))}
        </span>
      );
    case "descriptions":
      return (
        <span className="flex h-full flex-col gap-1.5">
          <span className="line-clamp-2">Order eggless and custom cakes in Indiranagar. Baked fresh, delivered the same day.</span>
          <span className="mt-auto flex gap-1.5">
            <Pill tone="good">138 characters</Pill>
            <Pill tone="good">Reason to click</Pill>
          </span>
        </span>
      );
    case "faq":
      return (
        <span className="flex h-full flex-col gap-1">
          <span className="font-semibold text-fg">Q: Do you deliver on Sundays?</span>
          <span className="line-clamp-2">A: Yes. We deliver every day from 10 am to 8 pm across East Bengaluru.</span>
        </span>
      );
    case "faq-code":
      return (
        <span className={clsx("flex h-full flex-col gap-0.5", mono)}>
          <span>{"{"}</span>
          <span className="pl-2">
            &quot;@type&quot;: <span className="text-primary">&quot;FAQPage&quot;</span>,
          </span>
          <span className="truncate pl-2">&quot;mainEntity&quot;: [ &quot;Question&quot; … ]</span>
          <span>{"}"}</span>
        </span>
      );
  }
}
