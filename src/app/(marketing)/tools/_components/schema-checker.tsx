"use client";
// Schema markup checker: POSTs one page address to /api/public/tools/schema-checker and lists every JSON-LD block, the
// types found, invalid JSON and missing Google fields. The JSON comes from a third-party page: it is shown inside <pre>
// as React text (auto-escaped), never as HTML.
import { Badge, Notice } from "@/components/ui";
import type { SchemaReport } from "@/lib/tools/schema";
import { CheckResults, PageUrlForm, ResultCard, ToolStatusBadge, usePageCheck } from "./page-check-ui";

type Result = SchemaReport & { url: string; finalUrl: string };

export function SchemaChecker() {
  const state = usePageCheck<Result>("/api/public/tools/schema-checker");
  const r = state.result;

  return (
    <div className="space-y-6">
      <PageUrlForm id="sc-url" hint="We read the schema markup (JSON-LD) in this one page's HTML." button="Check schema" busyText="Checking…" state={state} />

      {r && (
        <div className="space-y-6" aria-live="polite">
          {r.finalUrl !== r.url && (
            <Notice tone="info">
              That address redirected to <span className="break-all font-medium">{r.finalUrl}</span>. We checked the final page.
            </Notice>
          )}

          <CheckResults checks={r.checks} summary={r.summary} pageUrl={r.finalUrl} />

          {r.types.length > 0 && (
            <ResultCard title="Types found">
              <ul className="flex flex-wrap gap-2" aria-label="Schema types">
                {r.types.map((t) => (
                  <li key={t}>
                    <Badge tone="neutral" size="md">
                      {t}
                    </Badge>
                  </li>
                ))}
              </ul>
            </ResultCard>
          )}

          {r.nodes.length > 0 && (
            <ResultCard title="Field check by type" aside={<span className="text-xs text-muted">Against Google&apos;s documented fields</span>}>
              <ul className="divide-y divide-border">
                {r.nodes.map((n, i) => (
                  <li key={i} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-small font-medium text-fg">{n.type}</span>
                      {n.name && <span className="min-w-0 break-words text-small text-muted">“{n.name}”</span>}
                      <ToolStatusBadge status={n.status} />
                      <span className="text-xs text-muted">block {n.blockIndex}</span>
                    </div>
                    {n.missingRequired.length > 0 && (
                      <p className="mt-1 text-small text-fg-soft">
                        <span className="font-medium text-danger">Missing required: </span>
                        <code className="break-words">{n.missingRequired.join(", ")}</code>
                      </p>
                    )}
                    {n.missingRecommended.length > 0 && (
                      <p className="mt-1 text-small text-fg-soft">
                        <span className="font-medium text-warning">Missing recommended: </span>
                        <code className="break-words">{n.missingRecommended.join(", ")}</code>
                      </p>
                    )}
                    {n.status === "pass" && <p className="mt-1 text-small text-fg-soft">Has every field Google lists for this type.</p>}
                    {n.note && <p className="mt-1 text-xs text-muted">{n.note}</p>}
                    <a href={n.docUrl} rel="noopener" target="_blank" className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
                      Google&apos;s guide for {n.label}
                    </a>
                  </li>
                ))}
              </ul>
              {r.uncheckedTypes.length > 0 && (
                <p className="mt-3 text-xs text-muted">
                  Also found, not checked field by field: <span className="break-words">{r.uncheckedTypes.join(", ")}</span>.
                </p>
              )}
            </ResultCard>
          )}

          {(r.microdata.count > 0 || r.rdfa.count > 0) && (
            <Notice tone="info" title="Other markup formats on this page">
              {r.microdata.count > 0 && (
                <span className="block break-words">
                  Microdata: {r.microdata.count} item{r.microdata.count === 1 ? "" : "s"}
                  {r.microdata.types.length > 0 && ` (${r.microdata.types.join(", ")})`}.
                </span>
              )}
              {r.rdfa.count > 0 && (
                <span className="block break-words">
                  RDFa: {r.rdfa.count} item{r.rdfa.count === 1 ? "" : "s"}
                  {r.rdfa.types.length > 0 && ` (${r.rdfa.types.join(", ")})`}.
                </span>
              )}
              <span className="block">Google reads these too. This tool lists them but only checks JSON-LD field by field.</span>
            </Notice>
          )}

          {r.blocks.length > 0 && (
            <ResultCard title="The code we found">
              <div className="space-y-4">
                {r.blocks.map((b) => (
                  <details key={b.index} className="rounded-xl border border-border bg-bg" open={!b.valid || r.blocks.length === 1}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-small">
                      <span className="font-medium text-fg">Block {b.index}</span>
                      {b.valid ? <Badge tone="success">Valid JSON</Badge> : <Badge tone="danger">Invalid JSON</Badge>}
                      <span className="min-w-0 break-words text-muted">{b.types.join(", ")}</span>
                    </summary>
                    {b.error && <p className="px-3 pb-2 text-small text-danger">Error: {b.error}</p>}
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t border-border p-3 font-mono text-xs text-fg-soft">{b.code}</pre>
                    {b.truncated && <p className="px-3 pb-3 text-xs text-muted">This block is long, so we show only the start.</p>}
                  </details>
                ))}
              </div>
              {r.skippedBlocks > 0 && <p className="mt-3 text-xs text-muted">{r.skippedBlocks} more block(s) were skipped (we read up to 20 blocks of up to 200,000 characters each).</p>}
            </ResultCard>
          )}

          <Notice tone="tip">
            Valid markup makes a page eligible for rich results, such as stars or breadcrumbs in Google. It never guarantees them:
            Google decides case by case, and the markup must match what visitors see on the page.
          </Notice>
        </div>
      )}
    </div>
  );
}
