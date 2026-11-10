// "How we're different": four plain promises, each with a tiny picture of what it looks like in the product.
// Server component. Every word comes in through props (English and Hindi pages share it). The pictures are
// decorative (aria-hidden); the title and body of each item say the same thing as text.
import type { ReactNode } from "react";
import { ArrowDown, Check, IndianRupee, Link2, Minus, RotateCcw } from "lucide-react";

export type DiffVisual =
  | { kind: "plain"; before: string; after: string }
  | { kind: "approve"; approve: string; undo: string }
  | { kind: "ai"; engines: readonly string[]; named: string; linked: string; missed: string }
  | { kind: "inr"; price: string; per: string; notes: string[] };

export interface DiffItem {
  title: string;
  body: ReactNode;
  visual: DiffVisual;
}

export function DifferenceStrip({ items, caption, lang }: { items: DiffItem[]; caption: string; lang?: string }) {
  return (
    <figure lang={lang}>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.title} className="mk-reveal flex flex-col rounded-2xl border border-border bg-bg p-5">
            <div className="h-32 overflow-hidden rounded-xl bg-surface-2/70 p-3.5">
              <Visual v={it.visual} />
            </div>
            <h3 className="mt-5 text-h4 text-fg">{it.title}</h3>
            <p className="mt-2 text-small leading-relaxed text-muted">{it.body}</p>
          </li>
        ))}
      </ul>
      <figcaption className="mt-5 text-center text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

function Visual({ v }: { v: DiffVisual }) {
  if (v.kind === "plain")
    return (
      <div aria-hidden className="flex h-full flex-col justify-center gap-1.5 text-[12px]">
        <p className="truncate rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted line-through decoration-score-poor/60">{v.before}</p>
        <ArrowDown size={14} className="mx-auto shrink-0 text-border-strong" />
        <p className="truncate rounded-lg bg-primary-soft px-2.5 py-1.5 font-medium text-primary-soft-fg">{v.after}</p>
      </div>
    );
  if (v.kind === "approve")
    return (
      <div aria-hidden className="flex h-full flex-col justify-center gap-2.5">
        <div className="space-y-1">
          <span className="block h-2 w-full rounded-full bg-diff-remove" />
          <span className="block h-2 w-4/5 rounded-full bg-diff-add" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-fg px-3 text-[11px] font-medium text-bg">
            <Check size={12} />
            {v.approve}
          </span>
          <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 text-[11px] text-fg-soft">
            <RotateCcw size={11} />
            {v.undo}
          </span>
        </div>
      </div>
    );
  if (v.kind === "ai")
    return (
      <div aria-hidden className="flex h-full flex-col justify-between">
        <div className="flex flex-wrap gap-1">
          {v.engines.map((e) => (
            <span key={e} className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2 text-[10.5px] font-medium text-fg-soft">
              {e}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] text-fg-soft">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex size-4 items-center justify-center rounded-full border-[1.5px] border-primary text-primary">
              <Check size={9} strokeWidth={3} />
            </span>
            {v.named}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-fg">
              <Link2 size={9} strokeWidth={3} />
            </span>
            {v.linked}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex size-4 items-center justify-center text-border-strong">
              <Minus size={11} strokeWidth={3} />
            </span>
            {v.missed}
          </span>
        </div>
      </div>
    );
  return (
    <div aria-hidden className="flex h-full items-center gap-3">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <IndianRupee size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg">
          {v.price}
          <span className="ml-1 text-[11px] font-normal tracking-normal text-muted">{v.per}</span>
        </p>
        <ul className="mt-2 space-y-0.5">
          {v.notes.map((n) => (
            <li key={n} className="truncate text-[10.5px] text-fg-soft">
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
