"use client";
// Broken link checker: POSTs one page address to /api/public/tools/broken-link-checker and shows every link and image
// on that page with its status, filters and a client-side CSV download.
import { useMemo, useState, type FormEvent } from "react";
import { Download, Search } from "lucide-react";
import { Badge, Button, Field, Input, Notice, Table, TD, TH, THead, TR, type Tone } from "@/components/ui";
import type { LinkCheckReport, LinkClass, LinkResult } from "@/lib/tools/link-check";

const CLASS_INFO: Record<LinkClass, { label: string; tone: Tone; todo: string }> = {
  ok: { label: "OK", tone: "success", todo: "Nothing to do." },
  redirect: {
    label: "Redirect",
    tone: "warning",
    todo: "Works, but update the link to the final address so visitors and Google skip the extra hop.",
  },
  broken: {
    label: "Broken",
    tone: "danger",
    todo: "Update the link to the right page, add a 301 redirect if it is your own page that moved, or remove the link.",
  },
  timeout: {
    label: "Timeout",
    tone: "danger",
    todo: "Open it in your browser. If it is slow or down for you too, link somewhere else or remove the link.",
  },
  blocked: {
    label: "Blocked by site",
    tone: "info",
    todo: "The site refused our checker. It may work fine for people — open it in your browser to confirm.",
  },
  error: {
    label: "Can't connect",
    tone: "danger",
    todo: "Check the address for typos. If the site has closed, remove the link or point it somewhere else.",
  },
};

type Filter = "broken" | "redirect" | "blocked" | "ok" | "all";
const PROBLEM: LinkClass[] = ["broken", "timeout", "error"];
const FILTERS: { id: Filter; label: string; match: (c: LinkClass) => boolean }[] = [
  { id: "broken", label: "Broken", match: (c) => PROBLEM.includes(c) },
  { id: "redirect", label: "Redirects", match: (c) => c === "redirect" },
  { id: "blocked", label: "Blocked", match: (c) => c === "blocked" },
  { id: "ok", label: "OK", match: (c) => c === "ok" },
  { id: "all", label: "All", match: () => true },
];

/** CSV cell: quoted, and neutralised so spreadsheet apps don't run a cell that starts with = + - @ as a formula. */
function csvCell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(results: LinkResult[]): string {
  const head = ["URL", "Anchor text", "Type", "Internal or external", "Result", "Status", "Final URL", "Redirects", "Detail", "What to do"];
  const rows = results.map((r) => [
    r.url,
    r.text,
    r.kind,
    r.internal ? "internal" : "external",
    CLASS_INFO[r.class].label,
    r.status,
    r.finalUrl,
    r.chain.length,
    r.note,
    CLASS_INFO[r.class].todo,
  ]);
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function BrokenLinkChecker() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LinkCheckReport | null>(null);
  const [filter, setFilter] = useState<Filter>("broken");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Enter a page address like example.com/about.");
      return;
    }
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/public/tools/broken-link-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { report?: LinkCheckReport; error?: { message?: string } } | null;
      if (!res.ok || !data?.report) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      const r = data.report;
      setReport(r);
      setFilter(r.results.some((x) => PROBLEM.includes(x.class)) ? "broken" : "all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[FILTERS.length - 1];
    return (report?.results ?? []).filter((r) => f.match(r.class));
  }, [report, filter]);

  function download() {
    if (!report) return;
    const blob = new Blob(["﻿", toCsv(report.results)], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    let host = "page";
    try {
      host = new URL(report.finalUrl).hostname;
    } catch {
      /* keep default */
    }
    a.download = `broken-links-${host}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  }

  const problems = report ? report.counts.broken + report.counts.timeout + report.counts.error : 0;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5" noValidate>
        <Field label="Page address" htmlFor="blc-url" hint="We check every link and image on this one page." error={error}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="blc-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="example.com/about"
              value={url}
              maxLength={2048}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "blc-url-error" : "blc-url-hint"}
              className="sm:flex-1"
            />
            <Button type="submit" icon={<Search />} loading={busy} loadingText="Checking links…">
              Check links
            </Button>
          </div>
        </Field>
        {busy && (
          <p className="mt-3 text-small text-muted" role="status">
            Checking each link one by one. This can take up to 30 seconds.
          </p>
        )}
      </form>

      {report && (
        <div className="space-y-5" aria-live="polite">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-small text-muted">
              Checked <span className="font-medium text-fg">{report.checked}</span> of {report.found} links and images on{" "}
              <span className="break-all font-medium text-fg">{report.finalUrl}</span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Broken", value: problems, tone: problems ? "text-danger" : "text-fg" },
                { label: "Redirects", value: report.counts.redirect, tone: report.counts.redirect ? "text-warning" : "text-fg" },
                { label: "Blocked by site", value: report.counts.blocked, tone: "text-fg" },
                { label: "OK", value: report.counts.ok, tone: "text-success" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className={`text-h3 tabular-nums ${s.tone}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {report.unchecked > 0 && (
            <Notice tone="warning" title={`We stopped after ${report.checked} links`}>
              This free check has a 25-second time limit, so {report.unchecked} link{report.unchecked === 1 ? " was" : "s were"} not
              checked. The results below are complete for the links we did reach.
            </Notice>
          )}
          {report.capped && (
            <Notice tone="info">
              This page has {report.found} links and images. The free tool checks the first 150. A full site audit checks every
              page and link.
            </Notice>
          )}
          {report.found === 0 && <Notice tone="info">We didn&apos;t find any links or images on this page.</Notice>}

          {report.results.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Show results" className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => {
                    const n = report.results.filter((r) => f.match(r.class)).length;
                    const active = filter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilter(f.id)}
                        className={`h-8 rounded-full border px-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                          active ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:bg-surface-2"
                        }`}
                      >
                        {f.label} ({n})
                      </button>
                    );
                  })}
                </div>
                <Button variant="secondary" size="sm" icon={<Download />} onClick={download}>
                  Download CSV
                </Button>
              </div>

              {shown.length === 0 ? (
                <p className="rounded-xl border border-border bg-surface p-4 text-small text-muted">Nothing in this group.</p>
              ) : (
                <Table framed caption="Links and images on the page" density="compact">
                  <THead>
                    <tr>
                      <TH>Link</TH>
                      <TH>Status</TH>
                      <TH className="min-w-[14rem]">What to do</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {shown.map((r) => (
                      <TR key={r.url}>
                        <TD className="max-w-[22rem]">
                          <a href={r.url} rel="nofollow noopener noreferrer" target="_blank" className="break-all font-medium text-fg hover:underline">
                            {r.url}
                          </a>
                          <div className="mt-1 text-xs text-muted">
                            {r.text ? <>&ldquo;{r.text}&rdquo; · </> : null}
                            {r.kind === "image" ? "Image" : "Link"} · {r.internal ? "Internal" : "External"}
                          </div>
                        </TD>
                        <TD>
                          <Badge tone={CLASS_INFO[r.class].tone}>{CLASS_INFO[r.class].label}</Badge>
                          <div className="mt-1 text-xs tabular-nums text-muted">
                            {r.chain.length > 0
                              ? [...r.chain.map((h) => h.status), r.status ?? "—"].join(" → ")
                              : r.status ?? "no answer"}
                          </div>
                        </TD>
                        <TD>
                          <p className="text-small text-fg-soft">{r.note}</p>
                          <p className="mt-1 text-xs text-muted">{CLASS_INFO[r.class].todo}</p>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
