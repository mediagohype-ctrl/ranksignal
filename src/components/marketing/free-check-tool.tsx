"use client";
// Interactive free AI-readiness check: URL + captcha → POST /api/public/free-check → result.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, Card, Field, Input, ProgressSteps, fieldDescribedBy } from "@/components/ui";
import { Turnstile, isTurnstileConfigured } from "@/components/turnstile";
import type { FreeCheckResult } from "@/lib/free-check/types";
import { FreeCheckResultView } from "./free-check-result";

const STEPS = [
  { id: "home", label: "Read your homepage", after: 0 },
  { id: "robots", label: "Check AI crawler access", after: 4_000 },
  { id: "pages", label: "Read key pages", after: 8_000 },
  { id: "score", label: "Score SEO, AEO, GEO", after: 15_000 },
];

export function FreeCheckTool({ initialUrl = "" }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeCheckResult | null>(null);
  const autoRan = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const captcha = isTurnstileConfigured();

  const run = useCallback(
    async (target: string) => {
      if (!target.trim()) {
        setError("Enter your website address.");
        return;
      }
      if (captcha && !token) {
        setError("Please complete the security check first.");
        return;
      }
      setBusy(true);
      setError(null);
      setResult(null);
      setElapsed(0);
      const started = Date.now();
      const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
      try {
        const res = await fetch("/api/public/free-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target.trim(), turnstileToken: token || undefined }),
        });
        const data = (await res.json().catch(() => null)) as { item?: FreeCheckResult; error?: { message?: string } } | null;
        if (!res.ok || !data?.item) {
          setError(data?.error?.message ?? "Something went wrong. Please try again.");
        } else {
          setResult(data.item);
          requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
      } catch {
        setError("We couldn't reach our server. Check your connection and try again.");
      } finally {
        window.clearInterval(timer);
        setBusy(false);
        // Captcha tokens are single-use: get a fresh widget for the next attempt.
        setToken("");
        setWidgetKey((k) => k + 1);
      }
    },
    [captcha, token],
  );

  // Arriving from the homepage URL box: start automatically once the captcha (if any) is solved.
  useEffect(() => {
    if (autoRan.current || !initialUrl || busy) return;
    if (captcha && !token) return;
    autoRan.current = true;
    void run(initialUrl);
  }, [initialUrl, captcha, token, busy, run]);

  const stepIndex = STEPS.reduce((i, s, n) => (elapsed >= s.after ? n : i), 0);

  return (
    <div className="space-y-10">
      <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            autoRan.current = true;
            void run(url);
          }}
          className="space-y-5"
          noValidate
        >
          <Field label="Your website" htmlFor="fc-url" hint="Your homepage address, e.g. yourbusiness.com" error={error}>
            <Input
              id="fc-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={2048}
              inputSize="lg"
              invalid={!!error}
              disabled={busy}
              aria-describedby={fieldDescribedBy("fc-url", { hint: true, error })}
            />
          </Field>
          <Turnstile key={widgetKey} onToken={setToken} action="free_check" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">Free · no sign-up · we only read public pages.</p>
            <Button
              type="submit"
              size="lg"
              loading={busy}
              loadingText="Checking…"
              icon={result ? <RotateCcw /> : undefined}
              iconRight={result ? undefined : <ArrowRight />}
            >
              {result ? "Check again" : "Run free check"}
            </Button>
          </div>
        </form>

        {busy && (
          <div className="mt-6 border-t border-border pt-6" role="status" aria-live="polite">
            <ProgressSteps
              label="Free check progress"
              steps={STEPS.map((s, n) => ({ id: s.id, label: s.label, status: n < stepIndex ? "done" : n === stepIndex ? "active" : "pending" }))}
            />
            <p className="mt-4 text-xs text-muted">This usually takes 10–25 seconds.</p>
          </div>
        )}
      </Card>

      <div ref={resultRef} className="scroll-mt-24">
        {result && <FreeCheckResultView result={result} />}
      </div>
    </div>
  );
}
