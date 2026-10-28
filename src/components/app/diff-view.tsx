import clsx from "clsx";
import { ArrowRight, ArrowDown } from "lucide-react";
import { diffWords } from "@/lib/dashboard/diff";

const FIELD_LABEL: Record<string, string> = {
  meta_description: "Meta description",
  title: "Page title",
  excerpt: "Excerpt",
  content: "Page content",
  schema: "Structured data",
  brief: "Content brief",
  robots: "robots.txt",
};

/** Recommended length ranges shown under the "after" text (guidance, not hard rules). */
const LENGTH_HINT: Record<string, [number, number]> = {
  meta_description: [70, 160],
  title: [30, 60],
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function LengthNote({ field, text }: { field: string; text: string }) {
  const range = LENGTH_HINT[field];
  const n = text.length;
  if (!range) return <span className="tabular-nums">{n} characters</span>;
  const ok = n >= range[0] && n <= range[1];
  return (
    <span className={clsx("tabular-nums", ok ? "text-success" : "text-warning")}>
      {n} characters · aim for {range[0]}–{range[1]}
    </span>
  );
}

/**
 * Before/after preview with word-level highlights: removed words are struck through in "Now",
 * added words are highlighted in "After". Side by side from md, stacked on small screens.
 */
export function DiffView({ field, before, after, className }: { field: string; before: string | null; after: string; className?: string }) {
  const segs = diffWords(before, after);
  const empty = before === null || before === "";
  const added = segs.filter((s) => s.op === "add" && s.text.trim()).length;
  const removed = segs.filter((s) => s.op === "remove" && s.text.trim()).length;
  const mono = field === "schema" || field === "robots";

  return (
    <figure className={clsx("overflow-hidden rounded-xl border border-border", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2 sm:px-4">
        <span className="text-caption font-semibold uppercase tracking-[0.06em] text-muted">{fieldLabel(field)} · proposed change</span>
        <span className="flex items-center gap-3 text-caption text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-diff-remove ring-1 ring-danger/30" />
            {removed} removed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-diff-add ring-1 ring-success/30" />
            {added} added
          </span>
        </span>
      </figcaption>
      <div className="grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <section aria-label="Current text" className="min-w-0 bg-surface-2/40 p-3 sm:p-4">
          <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-muted">Now</h4>
          <div className={clsx("whitespace-pre-wrap break-words text-small leading-relaxed text-fg-soft", mono && "font-mono text-xs")}>
            {empty ? (
              <span className="italic text-muted">Nothing here yet</span>
            ) : (
              segs
                .filter((s) => s.op !== "add")
                .map((s, i) =>
                  s.op === "remove" ? (
                    <del key={i} className="rounded-sm bg-diff-remove px-0.5 decoration-danger/70">
                      <span className="sr-only">[removed: </span>
                      {s.text}
                      <span className="sr-only">]</span>
                    </del>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )
            )}
          </div>
          {!empty && <p className="mt-2 text-caption text-muted tabular-nums">{before!.length} characters</p>}
        </section>
        <div aria-hidden className="flex items-center justify-center border-y border-border bg-surface py-1 text-muted md:border-x md:border-y-0 md:px-1 md:py-0">
          <ArrowDown className="size-4 md:hidden" />
          <ArrowRight className="hidden size-4 md:block" />
        </div>
        <section aria-label="Proposed text" className="min-w-0 bg-surface p-3 sm:p-4">
          <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-success">After</h4>
          <div className={clsx("whitespace-pre-wrap break-words text-small leading-relaxed text-fg", mono && "font-mono text-xs")}>
            {segs
              .filter((s) => s.op !== "remove")
              .map((s, i) =>
                s.op === "add" ? (
                  <ins key={i} className="rounded-sm bg-diff-add px-0.5 no-underline">
                    <span className="sr-only">[added: </span>
                    {s.text}
                    <span className="sr-only">]</span>
                  </ins>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
          </div>
          <p className="mt-2 text-caption text-muted">
            <LengthNote field={field} text={after} />
          </p>
        </section>
      </div>
    </figure>
  );
}
