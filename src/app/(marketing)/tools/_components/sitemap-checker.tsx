"use client";
// XML sitemap checker & generator. "Check" POSTs a site address to /api/public/tools/sitemap-checker and shows the
// sitemaps found, problems with a fix for each, URL stats and a sample status check. "Generate" turns a pasted list of
// addresses into sitemap.xml entirely in the browser. Third-party data is rendered as React text only.
import { useMemo, useState, type FormEvent } from "react";
import { Copy, Download, ListChecks, Search, Wand2 } from "lucide-react";
import { Badge, Button, CheckStatusIcon, Field, Input, Notice, Tabs, TabPanel, Textarea } from "@/components/ui";
import type { IssueLevel, SampleVerdict, SitemapCheckReport } from "@/lib/tools/sitemap-check";
import { generateSitemap, GENERATOR_MAX_URLS } from "@/lib/tools/sitemap-generate";

const LEVEL: Record<IssueLevel, { label: string; tone: "danger" | "warning" | "info" | "success"; icon: string }> = {
  fail: { label: "Fix", tone: "danger", icon: "fail" },
  warn: { label: "Check", tone: "warning", icon: "warn" },
  info: { label: "Note", tone: "info", icon: "not_measured" },
  pass: { label: "Pass", tone: "success", icon: "pass" },
};

const VERDICT: Record<SampleVerdict, { label: string; tone: "success" | "warning" | "danger" }> = {
  ok: { label: "OK", tone: "success" },
  redirect: { label: "Redirect", tone: "warning" },
  not_found: { label: "Missing", tone: "danger" },
  error: { label: "Error", tone: "warning" },
};

const n = (x: number) => x.toLocaleString("en-US");

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-h3 text-fg tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Checker() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setResult] = useState<SitemapCheckReport | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Enter a website address like example.com.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/tools/sitemap-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { result?: SitemapCheckReport; error?: { message?: string } } | null;
      if (!res.ok || !data?.result) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const s = r?.stats;
  const pct = s && s.total ? Math.round((s.withLastmod / s.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5" noValidate>
        <Field label="Website address" htmlFor="smc-url" hint="We look in robots.txt, /sitemap.xml and /sitemap_index.xml. Nothing is saved." error={error}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="smc-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="example.com"
              value={url}
              maxLength={2048}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "smc-url-error" : "smc-url-hint"}
              className="sm:flex-1"
            />
            <Button type="submit" icon={<Search />} loading={busy} loadingText="Checking…">
              Check sitemap
            </Button>
          </div>
        </Field>
        {busy && (
          <p className="mt-3 text-small text-muted" role="status">
            Reading your sitemaps and testing a sample of pages. This can take up to 30 seconds.
          </p>
        )}
      </form>

      {r && s && (
        <div className="space-y-6" aria-live="polite">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-h4 text-fg">What we found</h2>
            <p className="mt-1 break-all text-xs text-muted">{r.origin}</p>
            <ul className="mt-4 divide-y divide-border">
              {r.issues.map((i, k) => (
                <li key={k} className="flex items-start gap-3 py-3">
                  <CheckStatusIcon status={LEVEL[i.level].icon} className="mt-0.5" size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-small font-medium text-fg">{i.title}</span>
                      <Badge tone={LEVEL[i.level].tone}>{LEVEL[i.level].label}</Badge>
                    </div>
                    <p className="mt-1 break-words text-small leading-relaxed text-muted">
                      <span className="font-medium text-fg">{i.level === "pass" ? "" : "What to do: "}</span>
                      {i.fix}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {s.total > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Page URLs read" value={n(s.total)} note={r.truncated ? "partial: we hit a limit" : undefined} />
              <Stat label="With a lastmod date" value={`${pct}%`} note={`${n(s.withLastmod)} of ${n(s.total)}`} />
              <Stat label="Older than 12 months" value={n(s.olderThan12Months)} note="by lastmod" />
              <Stat label="Duplicates" value={n(s.duplicates.count)} />
            </div>
          )}

          {r.docs.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-h4 text-fg">Sitemap files</h2>
              <ul className="mt-3 divide-y divide-border">
                {r.docs.map((d) => (
                  <li key={d.url} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs text-fg">{d.url}</p>
                      <p className="text-xs text-muted">
                        {d.source === "robots" ? "Listed in robots.txt" : d.source === "index" ? "From a sitemap index" : "Found at a standard address"}
                        {d.kind === "index" ? ` · sitemap index with ${n(d.entries)} sitemap${d.entries === 1 ? "" : "s"}` : ""}
                        {d.kind === "urlset" ? ` · ${n(d.entries)} URL${d.entries === 1 ? "" : "s"}` : ""}
                        {d.bytes ? ` · ${(d.bytes / 1024).toFixed(d.bytes < 10_240 ? 1 : 0)} KB` : ""}
                      </p>
                    </div>
                    {d.error ? (
                      <Badge tone="danger">Can&apos;t read</Badge>
                    ) : d.xmlError ? (
                      <Badge tone="danger">Invalid XML</Badge>
                    ) : d.kind === "unknown" ? (
                      <Badge tone="danger">Not a sitemap</Badge>
                    ) : (
                      <Badge tone="success">{d.kind === "index" ? "Index" : "Sitemap"}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(s.otherHost.count > 0 || s.nonHttps.count > 0 || s.invalid.count > 0 || s.duplicates.count > 0 || s.badLastmod.count > 0) && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-h4 text-fg">Examples</h2>
              <dl className="mt-3 space-y-3 text-small">
                {(
                  [
                    ["Not a full address", s.invalid],
                    ["Different host", s.otherHost],
                    ["Uses http://", s.nonHttps],
                    ["Duplicates", s.duplicates],
                    ["Bad lastmod format", s.badLastmod],
                  ] as const
                )
                  .filter(([, e]) => e.count > 0)
                  .map(([label, e]) => (
                    <div key={label}>
                      <dt className="font-medium text-fg">
                        {label} ({n(e.count)})
                      </dt>
                      <dd>
                        <ul className="mt-1 space-y-0.5">
                          {e.examples.map((x, i) => (
                            <li key={i} className="break-all font-mono text-xs text-fg-soft">
                              {x}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          {r.sample.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-h4 text-fg">Sample check: {r.sample.length} pages</h2>
              <p className="mt-1 text-small text-muted">We opened a spread of pages from your sitemap to spot missing pages and redirects.</p>
              <ul className="mt-3 divide-y divide-border">
                {r.sample.map((x) => (
                  <li key={x.url} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs text-fg">{x.url}</p>
                      <p className="break-all text-xs text-muted">{x.note}</p>
                    </div>
                    <Badge tone={VERDICT[x.verdict].tone}>{VERDICT[x.verdict].label}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Generator() {
  const [input, setInput] = useState("");
  const [withDate, setWithDate] = useState(false);
  const [today, setToday] = useState("");
  const [copied, setCopied] = useState(false);
  const g = useMemo(() => generateSitemap(input, withDate && today ? { lastmod: today } : {}), [input, withDate, today]);

  async function copy() {
    if (!g.xml) return;
    try {
      await navigator.clipboard.writeText(g.xml);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  function download() {
    if (!g.xml) return;
    const blob = new Blob([g.xml], { type: "application/xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "sitemap.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <Field
          label="Your page addresses, one per line"
          htmlFor="smg-input"
          hint={`Up to ${n(GENERATOR_MAX_URLS)} addresses, all on the same website. This runs in your browser; nothing is sent.`}
        >
          <Textarea
            id="smg-input"
            rows={12}
            className="font-mono text-xs"
            spellCheck={false}
            value={input}
            maxLength={2_500_000}
            onChange={(e) => {
              setCopied(false);
              setInput(e.target.value);
            }}
            placeholder={"https://example.com/\nhttps://example.com/services\nhttps://example.com/contact"}
          />
        </Field>
        <label className="flex items-center gap-2 text-small text-fg">
          <input type="checkbox" checked={withDate} onChange={(e) => {
              setWithDate(e.target.checked);
              setToday(new Date().toISOString().slice(0, 10));
            }} className="size-4 accent-primary" />
          Add today&apos;s date as lastmod{today ? ` (${today})` : ""}. Only do this if every page changed today.
        </label>
        {(g.rejected.length > 0 || g.duplicates > 0 || g.overLimit > 0) && (
          <Notice tone="warning" title="Some lines were left out">
            <ul className="space-y-1">
              {g.duplicates > 0 && <li>{n(g.duplicates)} duplicate address{g.duplicates === 1 ? "" : "es"} removed.</li>}
              {g.overLimit > 0 && <li>{n(g.overLimit)} address{g.overLimit === 1 ? "" : "es"} over the {n(GENERATOR_MAX_URLS)} limit.</li>}
              {g.rejected.slice(0, 8).map((x) => (
                <li key={x.line} className="break-all">
                  Line {x.line}: {x.reason}
                </li>
              ))}
              {g.rejected.length > 8 && <li>…and {n(g.rejected.length - 8)} more.</li>}
            </ul>
          </Notice>
        )}
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-small font-semibold text-fg">Your sitemap.xml {g.urls.length ? `(${n(g.urls.length)} URL${g.urls.length === 1 ? "" : "s"})` : ""}</p>
          <p className="mt-1 text-small text-muted">
            Upload it to your site&apos;s main folder as /sitemap.xml, then add the line Sitemap: https://{g.host ?? "yoursite.com"}/sitemap.xml to robots.txt.
          </p>
          <pre className="mt-4 max-h-112 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-4 text-xs text-fg-soft">
            {g.xml ?? "Paste at least one full address (starting with https://) to see your sitemap here."}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<Copy />} onClick={copy} disabled={!g.xml}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="secondary" icon={<Download />} onClick={download} disabled={!g.xml}>
              Download sitemap.xml
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SitemapChecker() {
  const [tab, setTab] = useState<"check" | "generate">("check");
  return (
    <div>
      <Tabs
        label="Sitemap tool"
        idPrefix="smc"
        variant="pills"
        value={tab}
        onChange={(v) => setTab(v as "check" | "generate")}
        tabs={[
          { id: "check", label: "Check my sitemap", icon: <ListChecks /> },
          { id: "generate", label: "Generate a sitemap", icon: <Wand2 /> },
        ]}
      />
      <TabPanel idPrefix="smc" value={tab}>
        {/* Both stay mounted so switching tabs keeps results and typed text. */}
        <div hidden={tab !== "check"}>
          <Checker />
        </div>
        <div hidden={tab !== "generate"}>
          <Generator />
        </div>
      </TabPanel>
    </div>
  );
}
