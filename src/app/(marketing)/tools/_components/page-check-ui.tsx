"use client";
// Shared pieces for the single-page checkers (meta tags, headings, schema): the address form, the request hook and the
// pass/warn/fail list with a "what to do" line per problem. All page data is untrusted and rendered as plain text.
import { useState, type FormEvent, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge, Button, CheckStatusIcon, Field, Input } from "@/components/ui";
import type { ToolCheck, ToolStatus } from "@/lib/tools/meta-tags";

export function usePageCheck<T>(endpoint: string) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Enter a page address like example.com/about.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
      if (!res.ok || !data?.result) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return { url, setUrl, busy, error, result, submit };
}

export function PageUrlForm({
  id,
  hint,
  button,
  busyText,
  state,
}: {
  id: string;
  hint: string;
  button: string;
  busyText: string;
  state: { url: string; setUrl: (v: string) => void; busy: boolean; error: string | null; submit: (e: FormEvent) => void };
}) {
  return (
    <form onSubmit={state.submit} className="rounded-2xl border border-border bg-surface p-5" noValidate>
      <Field label="Page address" htmlFor={id} hint={hint} error={state.error}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="example.com/about"
            value={state.url}
            maxLength={2048}
            onChange={(e) => state.setUrl(e.target.value)}
            aria-invalid={!!state.error || undefined}
            aria-describedby={state.error ? `${id}-error` : `${id}-hint`}
            className="sm:flex-1"
          />
          <Button type="submit" icon={<Search />} loading={state.busy} loadingText={busyText}>
            {button}
          </Button>
        </div>
      </Field>
      {state.busy && (
        <p className="mt-3 text-small text-muted" role="status">
          Fetching the page. This usually takes a few seconds.
        </p>
      )}
    </form>
  );
}

const STATUS_BADGE: Record<ToolStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  pass: { label: "Pass", tone: "success" },
  warn: { label: "Check", tone: "warning" },
  fail: { label: "Fix", tone: "danger" },
};

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  const s = STATUS_BADGE[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Summary line + list of checks, problems first, each with its fix. */
export function CheckResults({ checks, summary, pageUrl, title = "What we found" }: { checks: ToolCheck[]; summary: Record<ToolStatus, number>; pageUrl: string; title?: string }) {
  const order: Record<ToolStatus, number> = { fail: 0, warn: 1, pass: 2 };
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h4 text-fg">{title}</h2>
        <p className="text-small text-muted">
          <span className="text-danger">{summary.fail} to fix</span> · <span className="text-warning">{summary.warn} to check</span> ·{" "}
          <span className="text-success">{summary.pass} passed</span>
        </p>
      </div>
      <p className="mt-1 break-all text-xs text-muted">{pageUrl}</p>
      <ul className="mt-4 divide-y divide-border">
        {sorted.map((c) => (
          <li key={c.id} className="flex items-start gap-3 py-3">
            <CheckStatusIcon status={c.status} className="mt-0.5" size={18} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-small font-medium text-fg">{c.label}</span>
                <ToolStatusBadge status={c.status} />
              </div>
              <p className="mt-1 break-words text-small leading-relaxed text-fg-soft">{c.detail}</p>
              {c.fix && (
                <p className="mt-1 break-words text-small leading-relaxed text-muted">
                  <span className="font-medium text-fg">What to do: </span>
                  {c.fix}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResultCard({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h4 text-fg">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
