"use client";
// "Is my site blocked from AI?": POSTs a site address to /api/public/tools/ai-crawler-checker and shows, per AI crawler,
// whether robots.txt lets it read the homepage (grouped into AI answers vs AI training), plus page-level signals and
// ready-to-copy robots.txt snippets. Third-party data is rendered as React text only.
import { useState, type FormEvent } from "react";
import { Copy, Search } from "lucide-react";
import { Badge, Button, Field, Input, Notice } from "@/components/ui";
import type { AiCrawlerReport, AiCrawlerRow } from "@/lib/tools/ai-crawlers";

type Result = AiCrawlerReport & { site: string; homeUrl: string };

function CrawlerTable({ title, intro, rows }: { title: string; intro: string; rows: AiCrawlerRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-h4 text-fg">{title}</h2>
      <p className="mt-1 text-small text-muted">{intro}</p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.token} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-small font-semibold text-fg">{r.token}</span>{" "}
                <span className="text-small text-muted">
                  {r.owner} · {r.label}
                </span>
              </div>
              <Badge tone={r.allowed ? "success" : r.group === "training" ? "neutral" : "danger"} size="md">
                {r.allowed ? "Allowed" : "Blocked"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {r.explicit ? "Your robots.txt names this crawler directly." : "Follows your general rules (User-agent: *)."}
            </p>
            {r.note && <p className="mt-1 text-xs leading-relaxed text-fg-soft">{r.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Snippet({ id, title, body, code }: { id: string; title: string; body: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 id={id} className="text-h4 text-fg">
        {title}
      </h3>
      <p className="mt-1 text-small text-muted">{body}</p>
      <pre aria-labelledby={id} className="mt-3 max-h-72 overflow-auto rounded-lg bg-surface-2 p-4 text-xs text-fg-soft">
        {code}
      </pre>
      <Button className="mt-3" variant="secondary" size="sm" icon={<Copy />} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AiCrawlerChecker() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setResult] = useState<Result | null>(null);

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
      const res = await fetch("/api/public/tools/ai-crawler-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { result?: Result; error?: { message?: string } } | null;
      if (!res.ok || !data?.result) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5" noValidate>
        <Field label="Website address" htmlFor="acc-url" hint="We read your robots.txt and your homepage. Nothing is saved." error={error}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="acc-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="example.com"
              value={url}
              maxLength={2048}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "acc-url-error" : "acc-url-hint"}
              className="sm:flex-1"
            />
            <Button type="submit" icon={<Search />} loading={busy} loadingText="Checking…">
              Check AI access
            </Button>
          </div>
        </Field>
        {busy && (
          <p className="mt-3 text-small text-muted" role="status">
            Reading your robots.txt and homepage. This usually takes a few seconds.
          </p>
        )}
      </form>

      {r && (
        <div className="space-y-6" aria-live="polite">
          <Notice tone={r.summary.tone}title={r.summary.title}>
            {r.summary.body}
            <span className="mt-1 block text-xs text-muted">
              robots.txt:{" "}
              {r.robotsFound
                ? `found (HTTP ${r.robotsStatus})`
                : r.robotsStatus === null
                  ? "could not be reached"
                  : `not found (HTTP ${r.robotsStatus}), so no crawler is blocked by it`}
              {" · "}homepage: {r.pageChecked ? `checked (HTTP ${r.pageStatus})` : r.pageStatus ? `not checked (HTTP ${r.pageStatus})` : "could not be reached"}
            </span>
          </Notice>

          <div className="grid gap-6 lg:grid-cols-2">
            <CrawlerTable
              title="AI search and answers"
              intro="These fetch pages to answer questions and link to sources. Blocking them keeps you out of those answers."
              rows={r.answers}
            />
            <CrawlerTable
              title="AI training"
              intro="These collect pages to train AI models. Blocking them is a business choice; it does not hide you from AI search."
              rows={r.training}
            />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-h4 text-fg">Signals on your homepage</h2>
            <p className="mt-1 text-small text-muted">Robots meta tags and the X-Robots-Tag header can limit search and AI use page by page.</p>
            {!r.pageChecked && r.signals.length === 0 ? (
              <p className="mt-3 text-small text-fg-soft">We couldn&apos;t read your homepage, so we only checked robots.txt.</p>
            ) : r.signals.length === 0 ? (
              <p className="mt-3 text-small text-fg-soft">
                None found. Your homepage has no noindex, nosnippet, noai or noimageai instruction.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {r.signals.map((s) => (
                  <li key={`${s.source}|${s.appliesTo}|${s.directive}`} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={s.tone}>{s.directive}</Badge>
                      <span className="font-mono text-xs text-fg-soft">{s.source}</span>
                      <span className="text-xs text-muted">{s.appliesTo === "all" ? "applies to all crawlers" : `applies to ${s.appliesTo}`}</span>
                    </div>
                    <p className="mt-1 text-small leading-relaxed text-fg-soft">{s.meaning}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Snippet
              id="acc-snippet-split"
              title="Allow AI search, block AI training"
              body="Add these lines to your robots.txt, below your existing rules. Keep your User-agent: * group as it is."
              code={r.snippets.allowSearchBlockTraining}
            />
            <Snippet
              id="acc-snippet-all"
              title="Allow all AI crawlers"
              body="Use this if you want every AI tool to read and learn from your site. Remove any older AI blocks first."
              code={r.snippets.allowAll}
            />
          </div>
        </div>
      )}
    </div>
  );
}
