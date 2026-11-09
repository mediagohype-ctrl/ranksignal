"use client";
// Heading structure checker: POSTs one page address to /api/public/tools/heading-checker and shows the H1–H6 outline as
// an indented tree with per-heading flags. Heading text is third-party content, rendered as React text only.
import { Badge, Notice } from "@/components/ui";
import type { HeadingReport } from "@/lib/tools/headings";
import { CheckResults, PageUrlForm, ResultCard, usePageCheck } from "./page-check-ui";

type Result = HeadingReport & { url: string; finalUrl: string };

const LEVEL_STYLE: Record<number, string> = {
  1: "bg-primary text-primary-fg",
  2: "bg-primary-soft text-primary-soft-fg",
  3: "bg-accent-soft text-accent",
  4: "bg-surface-2 text-fg-soft",
  5: "bg-surface-2 text-muted",
  6: "bg-surface-2 text-muted",
};

export function HeadingChecker() {
  const state = usePageCheck<Result>("/api/public/tools/heading-checker");
  const r = state.result;

  return (
    <div className="space-y-6">
      <PageUrlForm id="hc-url" hint="We read the H1 to H6 headings of this one page." button="Check headings" busyText="Checking…" state={state} />

      {r && (
        <div className="space-y-6" aria-live="polite">
          {r.finalUrl !== r.url && (
            <Notice tone="info">
              That address redirected to <span className="break-all font-medium">{r.finalUrl}</span>. We checked the final page.
            </Notice>
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Headings", value: r.counts.total },
              { label: "H1 headings", value: r.counts.byLevel[1] },
              { label: "Question headings", value: r.questionCount },
              { label: "With a short answer", value: r.questionCount ? `${r.questionsWithConciseAnswer} of ${r.questionCount}` : "–" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="text-h3 tabular-nums text-fg">{s.value}</dd>
              </div>
            ))}
          </dl>

          <CheckResults checks={r.checks} summary={r.summary} pageUrl={r.finalUrl} />

          {r.outline.length > 0 && (
            <ResultCard title="Heading outline" aside={<span className="text-xs text-muted">In page order, indented by level</span>}>
              <ol className="space-y-1.5">
                {r.outline.map((h, i) => (
                  <li key={i} style={{ paddingLeft: `${Math.min(h.depth, 5) * 1.25}rem` }} className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded px-1 font-mono text-xs font-semibold ${LEVEL_STYLE[h.level]}`}>
                      H{h.level}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`break-words text-small ${h.empty ? "italic text-danger" : "text-fg"}`}>{h.empty ? "(empty heading)" : h.text}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {h.skippedFrom !== null && <Badge tone="warning">Skips from H{h.skippedFrom}</Badge>}
                        {h.long && <Badge tone="warning">{h.text.length} characters</Badge>}
                        {h.question && <Badge tone="info">Question</Badge>}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {r.truncated && <p className="mt-3 text-xs text-muted">This page has a lot of headings. We show the first 200.</p>}
            </ResultCard>
          )}
        </div>
      )}
    </div>
  );
}
