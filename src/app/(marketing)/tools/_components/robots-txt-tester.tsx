"use client";
// Robots.txt tester: fetch a site's robots.txt through /api/public/tools/robots-txt-tester, or paste the text (no network),
// then lint it line by line and test any crawler + path in the browser with RFC 9309 longest-match rules.
// The file is third-party text: rendered as React text only (auto-escaped).
import { useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { Download, FileText, Search } from "lucide-react";
import { Badge, Button, Field, Input, Notice, Select, Tabs, TabPanel, Textarea } from "@/components/ui";
import {
  createRobotsTester,
  lintRobots,
  robotsStatusNote,
  ROBOTS_INPUT_MAX_CHARS,
  TESTER_CRAWLERS,
  type RobotsFetchResult,
  type RobotsLine,
} from "@/lib/tools/robots-tester";

const MAX_SHOWN_LINES = 2_000;
const SAMPLE = "User-agent: *\nDisallow: /cart/\nDisallow: /search\nAllow: /search/help\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml\n";

const LEVEL_TONE = { error: "danger", warning: "warning", info: "info" } as const;
const LEVEL_LABEL = { error: "Error", warning: "Check", info: "Note" } as const;

function LineView({ line, highlight }: { line: RobotsLine; highlight: "allow" | "block" | null }) {
  return (
    <li
      className={clsx(
        "grid grid-cols-[3rem_1fr] gap-2 px-2 py-0.5",
        highlight === "allow" && "bg-success-soft",
        highlight === "block" && "bg-danger-soft",
      )}
      aria-current={highlight ? "true" : undefined}
    >
      <span className="select-none text-right text-muted tabular-nums">{line.n}</span>
      <span className="min-w-0">
        <span className={clsx("whitespace-pre-wrap break-all", line.kind === "comment" ? "text-muted" : "text-fg")}>{line.text || " "}</span>
        {highlight && <span className="ml-2 font-sans text-xs font-semibold text-fg">← deciding rule</span>}
        {line.problem && (
          <span className="mt-0.5 flex items-start gap-1.5 font-sans text-xs text-fg-soft">
            <Badge tone={LEVEL_TONE[line.problem.level]}>{LEVEL_LABEL[line.problem.level]}</Badge>
            <span className="pt-0.5">{line.problem.message}</span>
          </span>
        )}
      </span>
    </li>
  );
}

export function RobotsTxtTester() {
  const [mode, setMode] = useState<"fetch" | "paste">("fetch");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<RobotsFetchResult | null>(null);
  const [pasted, setPasted] = useState("");
  const [token, setToken] = useState("Googlebot");
  const [path, setPath] = useState("/");

  // A 4xx means "no robots.txt": test against an empty file (everything allowed). A 5xx or failed fetch has no
  // testable rules (Google treats a 5xx as "blocked"), so the notice explains it instead.
  const fetchedText =
    fetched === null ? null : fetched.text ?? (fetched.status !== null && fetched.status >= 400 && fetched.status < 500 && fetched.status !== 429 ? "" : null);
  const text = mode === "fetch" ? fetchedText : pasted;
  const lint = useMemo(() => (text !== null ? lintRobots(text) : null), [text]);
  const tester = useMemo(() => (text !== null && lint ? createRobotsTester(text, lint) : null), [text, lint]);
  const test = tester ? tester(token, path) : null;
  const all = tester && test ? TESTER_CRAWLERS.map((c) => ({ c, r: tester(c.token, path) })) : [];

  async function fetchRobots(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Enter a website address like example.com.");
      return;
    }
    setBusy(true);
    setError(null);
    setFetched(null);
    try {
      const res = await fetch("/api/public/tools/robots-txt-tester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { result?: RobotsFetchResult; error?: { message?: string } } | null;
      if (!res.ok || !data?.result) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      setFetched(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const note = fetched ? robotsStatusNote(fetched.status, fetched.redirectChain.length) : null;
  const shown = lint ? lint.lines.slice(0, MAX_SHOWN_LINES) : [];
  const matched = test?.matchedLine ?? null;

  return (
    <div className="space-y-6">
      <Tabs
        label="How to get your robots.txt"
        idPrefix="rtt"
        variant="pills"
        value={mode}
        onChange={(v) => setMode(v as "fetch" | "paste")}
        tabs={[
          { id: "fetch", label: "Fetch from my website", icon: <Download /> },
          { id: "paste", label: "Paste robots.txt text", icon: <FileText /> },
        ]}
      />
      <TabPanel idPrefix="rtt" value={mode} className="pt-0">
        {mode === "fetch" ? (
          <form onSubmit={fetchRobots} className="rounded-2xl border border-border bg-surface p-5" noValidate>
            <Field label="Website address" htmlFor="rtt-url" hint="We read yoursite.com/robots.txt. Nothing is saved." error={error}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="rtt-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="example.com"
                  value={url}
                  maxLength={2048}
                  onChange={(e) => setUrl(e.target.value)}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "rtt-url-error" : "rtt-url-hint"}
                  className="sm:flex-1"
                />
                <Button type="submit" icon={<Search />} loading={busy} loadingText="Fetching…">
                  Fetch robots.txt
                </Button>
              </div>
            </Field>
          </form>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <Field
              label="Your robots.txt text"
              htmlFor="rtt-text"
              hint="Paste a file, or edit a draft before you publish it. This runs in your browser; nothing is sent."
              labelAside={
                <Button variant="link" onClick={() => setPasted(SAMPLE)}>
                  Use an example
                </Button>
              }
            >
              <Textarea
                id="rtt-text"
                rows={10}
                className="font-mono text-xs"
                value={pasted}
                maxLength={ROBOTS_INPUT_MAX_CHARS}
                spellCheck={false}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"User-agent: *\nDisallow: /private/"}
              />
            </Field>
            {fetched?.text ? (
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => setPasted(fetched.text ?? "")}>
                Copy in the file we fetched
              </Button>
            ) : null}
          </div>
        )}
      </TabPanel>

      <div aria-live="polite" className="space-y-6">
        {mode === "fetch" && fetched && note && (
          <div className="space-y-3">
            <Notice tone={note.tone} title={note.title}>
              {note.body}
              <span className="mt-1 block break-all text-xs text-muted">
                {fetched.finalUrl ?? fetched.robotsUrl}
                {fetched.redirectChain.length > 0 ? ` (from ${fetched.robotsUrl})` : ""}
              </span>
            </Notice>
            {fetched.error && <Notice tone="warning">{fetched.error}</Notice>}
          </div>
        )}

        {lint && text !== null && (mode === "paste" ? text.trim() !== "" : true) && (
          <>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
                <h2 className="text-h4 text-fg">Test a crawler and a page</h2>
                <Field label="Crawler" htmlFor="rtt-bot">
                  <Select id="rtt-bot" value={token} onChange={(e) => setToken(e.target.value)}>
                    {TESTER_CRAWLERS.map((c) => (
                      <option key={c.token} value={c.token}>
                        {c.token === "*" ? c.label : `${c.token} — ${c.label}`}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Page path or address" htmlFor="rtt-path" hint="For example /blog/my-post or a full address on this site.">
                  <Input id="rtt-path" value={path} maxLength={2000} spellCheck={false} onChange={(e) => setPath(e.target.value)} className="font-mono" />
                </Field>
                {test ? (
                  <div className={clsx("rounded-xl border p-4", test.allowed ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft")} role="status">
                    <p className="text-h4 text-fg">
                      <Badge tone={test.allowed ? "success" : "danger"} size="md">
                        {test.allowed ? "Allowed" : "Blocked"}
                      </Badge>{" "}
                      <span className="break-all font-mono text-small">{test.path}</span>
                    </p>
                    <p className="mt-2 text-small leading-relaxed text-fg-soft">{test.explanation}</p>
                  </div>
                ) : (
                  <Notice tone="warning">That doesn&apos;t look like a page path. Use something like /contact.</Notice>
                )}
                {all.length > 0 && (
                  <details className="text-small">
                    <summary className="cursor-pointer font-medium text-fg">Every crawler on this path</summary>
                    <ul className="mt-2 divide-y divide-border">
                      {all.map(({ c, r }) => (
                        <li key={c.token} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-xs text-fg">{c.token}</span> <span className="text-muted">{c.token === "*" ? "" : c.owner}</span>
                          </span>
                          {r && <Badge tone={r.allowed ? "success" : "danger"}>{r.allowed ? "Allowed" : "Blocked"}</Badge>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h2 className="text-h4 text-fg">What we found in the file</h2>
                  <ul className="mt-3 space-y-1.5 text-small text-fg-soft">
                    <li>
                      <span className="font-medium text-fg">{lint.groups.length}</span> crawler group{lint.groups.length === 1 ? "" : "s"},{" "}
                      <span className="font-medium text-fg">{lint.lines.length}</span> line{lint.lines.length === 1 ? "" : "s"},{" "}
                      {(lint.bytes / 1024).toFixed(1)} KB
                    </li>
                    <li>
                      <span className={lint.errors ? "font-medium text-danger" : "font-medium text-success"}>{lint.errors} error{lint.errors === 1 ? "" : "s"}</span>
                      {" · "}
                      <span className={lint.warnings ? "font-medium text-warning" : "font-medium text-fg"}>{lint.warnings} to check</span>
                    </li>
                    <li>
                      Sitemap lines:{" "}
                      {lint.sitemaps.length ? (
                        <span className="break-all">{lint.sitemaps.map((s) => s.url).join(", ")}</span>
                      ) : (
                        <span className="text-warning">none. Add a Sitemap: line so crawlers find your pages.</span>
                      )}
                    </li>
                  </ul>
                  {lint.blocksEveryone && (
                    <Notice tone="danger" className="mt-3" title="This file blocks every crawler from the whole site">
                      User-agent: * with Disallow: / tells Google and all crawlers without their own group to stay out. Remove that line unless the site is
                      private on purpose.
                    </Notice>
                  )}
                  {lint.overGoogleLimit && (
                    <Notice tone="warning" className="mt-3">
                      The file is over 500 KB. Google ignores everything after the first 500 KB, so put important rules near the top.
                    </Notice>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-h4 text-fg">The file, line by line</h2>
              <p className="mt-1 text-small text-muted">Problems show under the line. The rule that decides your test above is highlighted.</p>
              {lint.lines.length === 0 || (lint.lines.length === 1 && !lint.lines[0].text) ? (
                <p className="mt-4 text-small text-fg-soft">The file is empty, so every crawler may read every page.</p>
              ) : (
                <ol className="mt-4 max-h-128 overflow-auto rounded-lg bg-surface-2 py-2 font-mono text-xs" aria-label="robots.txt lines">
                  {shown.map((l) => (
                    <LineView key={l.n} line={l} highlight={matched === l.n ? (test?.allowed ? "allow" : "block") : null} />
                  ))}
                </ol>
              )}
              {lint.lines.length > MAX_SHOWN_LINES && (
                <p className="mt-2 text-xs text-muted">Showing the first {MAX_SHOWN_LINES.toLocaleString("en-US")} lines. Tests still use the whole file.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
