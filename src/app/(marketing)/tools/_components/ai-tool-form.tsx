"use client";
// Shared pieces for the free AI writing tools: the captcha + POST hook, the "AI draft" notice, pass/warn badge,
// copy button and a Google search result preview.
import { useCallback, useState, type ReactNode } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { Turnstile, isTurnstileConfigured } from "@/components/turnstile";
import type { DraftCheck } from "@/lib/tools/ai-writing-checks";

/** POST to an AI tool route with a fresh captcha token each time. */
export function useAiTool<T>(endpoint: string, action: string) {
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const captcha = isTurnstileConfigured();

  const run = useCallback(
    async (body: Record<string, unknown>): Promise<T | null> => {
      if (captcha && !token) {
        setError("Tick the security check above the button, then try again.");
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, turnstileToken: token || undefined }),
        });
        const data = (await res.json().catch(() => null)) as { item?: T; error?: { message?: string } } | null;
        if (!res.ok || !data?.item) {
          setError(data?.error?.message ?? "Something went wrong on our side. Please try again in a minute.");
          return null;
        }
        setResult(data.item);
        return data.item;
      } catch {
        setError("We couldn't reach our server. Check your connection and try again.");
        return null;
      } finally {
        setBusy(false);
        // Captcha tokens are single-use: get a fresh widget for the next run.
        setToken("");
        setWidgetKey((k) => k + 1);
      }
    },
    [captcha, endpoint, token],
  );

  const captchaNode = <Turnstile key={widgetKey} onToken={setToken} action={action} />;
  return { run, busy, error, setError, result, setResult, captchaNode };
}

export function AiDraftNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface-2 p-4 text-small text-fg-soft" role="note">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p>
        <strong className="text-fg">AI drafts: review before you use them.</strong>{" "}
        {children ?? "Check every fact, price and claim against your business, and edit the wording so it sounds like you."}
      </p>
    </div>
  );
}

export function CheckBadge({ check, unit = "characters" }: { check: DraftCheck; unit?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={check.status === "pass" ? "success" : "warning"}>{check.status === "pass" ? "Pass" : "Check"}</Badge>
      <span className="text-xs text-muted">
        {check.length} {unit}
      </span>
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={copied ? <Check /> : <Copy />}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Approximate Google result: long text is cut with "…" the way Google does (about 60 / 155 characters). */
export function GooglePreview({ title, description, url }: { title: string; description: string; url: string }) {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  return (
    <figure className="rounded-xl border border-border bg-surface p-4" aria-label="Google result preview">
      <figcaption className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Preview in Google (approximate)</figcaption>
      <p className="truncate text-xs text-fg-soft">{url}</p>
      <p className="mt-1 text-lg leading-snug text-primary">{cut(title, 60)}</p>
      <p className="mt-1 text-small leading-relaxed text-fg-soft">{cut(description, 158)}</p>
    </figure>
  );
}
