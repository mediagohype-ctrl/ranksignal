"use client";
// Free AI visibility checker form + result. The result shows before any sign-up; the trial / tracking offer comes
// after it (SEO fix brief P1). Server: /api/public/tools/ai-visibility-checker.
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Search, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { Button, Card, Field, Input, ScoreRing } from "@/components/ui";
import { useAiTool } from "./ai-tool-form";
import type { AiCheckResult } from "@/lib/tools/ai-visibility-check";

export function AiVisibilityChecker() {
  const [business, setBusiness] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const { run, busy, error, setError, result, captchaNode } = useAiTool<AiCheckResult>(
    "/api/public/tools/ai-visibility-checker",
    "ai_visibility_checker",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (business.trim().length < 2 || category.trim().length < 2) {
      setError("Fill in your business name and what you do.");
      return;
    }
    const item = await run({ business, category, city });
    if (item) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="space-y-8">
      <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="Your business name" htmlFor="avc-business" hint="As customers know it, e.g. Sharma Sweets" required>
            <Input id="avc-business" value={business} maxLength={80} onChange={(e) => setBusiness(e.target.value)} disabled={busy} required />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="What you do" htmlFor="avc-category" hint="e.g. sweet shop, dentist, CA firm" required>
              <Input id="avc-category" placeholder="sweet shop" value={category} maxLength={80} onChange={(e) => setCategory(e.target.value)} disabled={busy} required />
            </Field>
            <Field label="City or area" htmlFor="avc-city" optional>
              <Input id="avc-city" placeholder="Karol Bagh, Delhi" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} disabled={busy} />
            </Field>
          </div>
          {captchaNode}
          {error && (
            <p className="text-small text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">Free · no sign-up · 3 checks per hour.</p>
            <Button type="submit" size="lg" loading={busy} loadingText="Asking ChatGPT, Gemini and Perplexity…" icon={<Sparkles />}>
              {result ? "Check again" : "Check my AI visibility"}
            </Button>
          </div>
          {busy && <p className="text-center text-xs text-muted">This takes about 20–40 seconds. We ask each AI assistant with web search on.</p>}
        </form>
      </Card>

      <div ref={resultRef} className="mx-auto max-w-3xl scroll-mt-24 space-y-5" aria-live="polite">
        {result && <AiCheckResultView r={result} />}
      </div>
    </div>
  );
}

function AiCheckResultView({ r }: { r: AiCheckResult }) {
  const verdict =
    r.namedCount === 0
      ? "AI assistants don't name you yet"
      : r.namedCount === r.asked
        ? "Every AI assistant we asked named you"
        : `${r.namedCount} of ${r.asked} AI assistants named you`;
  return (
    <>
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <ScoreRing score={r.score} size="lg" label="AI visibility score" />
          <div className="min-w-0">
            <p className="eyebrow">AI visibility · {r.business}</p>
            <h2 className="mt-2 text-h3 text-fg">{verdict}</h2>
            <p className="mt-2 inline-flex items-start gap-2 text-small text-fg-soft">
              <Search aria-hidden size={15} className="mt-0.5 shrink-0 text-muted" />
              <span>
                We asked: <q className="font-medium text-fg">{r.question}</q>
              </span>
            </p>
          </div>
        </div>
      </Card>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {r.results.map((a) => (
          <li key={a.assistant} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="text-body font-semibold text-fg">{a.assistant}</p>
              {!a.ok ? (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">No answer</span>
              ) : a.named ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-score-good-soft px-2.5 py-1 text-xs font-semibold text-score-good">
                  <Check aria-hidden size={13} strokeWidth={3} />
                  {a.position ? `Named · #${a.position}` : "Named"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                  <X aria-hidden size={13} strokeWidth={3} />
                  Not named
                </span>
              )}
            </div>
            {a.ok && a.others.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted">{a.named ? "Also named" : "Named instead"}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.others.map((o) => (
                    <li key={o} className="rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-fg-soft">
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {a.ok && a.excerpt && <p className={clsx("mt-4 line-clamp-4 text-xs leading-relaxed text-muted")}>“{a.excerpt}”</p>}
            {!a.ok && <p className="mt-3 text-xs text-muted">This assistant didn&apos;t answer in time. Try again in a minute.</p>}
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-muted">
        AI answers change from one day to the next, so one check is a snapshot. {r.cached ? "This result is from the last 24 hours." : ""}
      </p>

      <Card padding="lg" className="text-center">
        <h3 className="text-h4 text-fg">{r.namedCount === r.asked ? "Stay named every week" : "Find out why, and fix it"}</h3>
        <p className="mx-auto mt-2 max-w-xl text-small text-fg-soft">
          The full check asks ChatGPT, Gemini and Perplexity your customers&apos; real questions every week, shows who gets named instead and
          gives you the fixes in plain words. 7 days free, no card needed.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-fg hover:brightness-110">
            Start free trial
            <ArrowRight aria-hidden size={17} />
          </Link>
          <Link href="/free-check" className="inline-flex h-12 items-center justify-center rounded-xl border border-border-strong px-6 font-semibold text-fg hover:bg-surface-2">
            Check my website free
          </Link>
        </div>
      </Card>
    </>
  );
}
