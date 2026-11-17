"use client";
// Interactive free website check: URL + captcha → POST /api/public/free-check → result.
// Opened with the website already filled in (?url=… from the homepage box), it starts by itself: no second click.
// When the result is in, the form folds away, the page scrolls to the score and the long explanations below
// (HideWhenFreeCheckResult) are hidden so the result and its buttons stay in view.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { preconnect, preload } from "react-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, Card, Field, Input, ProgressSteps, fieldDescribedBy } from "@/components/ui";
import { Turnstile, TURNSTILE_SCRIPT_SRC, isTurnstileConfigured } from "@/components/turnstile";
import { freeCheckStrings, type FreeCheckLang } from "@/lib/free-check/strings";
import type { FreeCheckResult } from "@/lib/free-check/types";
import { FreeCheckResultView } from "./free-check-result";

const STEPS = [
  { id: "home", after: 0 },
  { id: "robots", after: 4_000 },
  { id: "pages", after: 8_000 },
  { id: "score", after: 15_000 },
] as const;

/** How long the automatic start waits for the security check before telling the person what to do. */
const SECURITY_HINT_AFTER_MS = 6_000;

/** Fired on `window` when a result appears or is cleared, so server-rendered sections can fold away. */
const RESULT_EVENT = "mwr:free-check-result";

export function FreeCheckTool({
  initialUrl = "",
  lang = "en",
  bookHref,
}: {
  initialUrl?: string;
  /** Language of the tool and its result ("hi" on /hi/free-check). */
  lang?: FreeCheckLang;
  /** "Book a free call" link, worked out on the server (the calendar link is a server-only setting). */
  bookHref?: string;
}) {
  const s = freeCheckStrings(lang);
  const [url, setUrl] = useState(initialUrl);
  const [token, setToken] = useState("");
  const [widgetKey, setWidgetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeCheckResult | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  // "waiting" = opened with a website filled in and the check has not started yet (it starts by itself).
  const [auto, setAuto] = useState<"idle" | "waiting" | "done">(initialUrl.trim() ? "waiting" : "idle");
  const [securitySlow, setSecuritySlow] = useState(false);
  /** True while the running check is the one that started by itself (its progress list keeps the security step). */
  const [autoStarted, setAutoStarted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const captcha = isTurnstileConfigured();

  // The automatic start can't begin before the security check has loaded and answered, so fetch its script as
  // early as the page itself (a <link rel="preload"> in the HTML) instead of after the page's own scripts ran.
  if (captcha && initialUrl.trim()) {
    preconnect("https://challenges.cloudflare.com");
    preload(TURNSTILE_SCRIPT_SRC, { as: "script" });
  }

  const run = useCallback(
    async (target: string) => {
      if (!target.trim()) {
        setError(s.errEmptyUrl);
        return;
      }
      if (captcha && !token) {
        setError(s.errCaptcha);
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
        const data = (await res.json().catch(() => null)) as { item?: FreeCheckResult; error?: { code?: string; message?: string } } | null;
        if (!res.ok || !data?.item) {
          const code = data?.error?.code;
          // "Invalid input" (a malformed request) says nothing useful: show the address hint instead.
          setError(s.serverError(code) ?? (code === "validation_error" ? s.errEmptyUrl : data?.error?.message) ?? s.errGeneric);
        } else {
          setResult(data.item);
          setFormOpen(false);
        }
      } catch {
        setError(s.errNetwork);
      } finally {
        window.clearInterval(timer);
        setBusy(false);
        // Captcha tokens are single-use: get a fresh widget for the next attempt.
        setToken("");
        setWidgetKey((k) => k + 1);
      }
    },
    [captcha, token, s],
  );

  // Arriving from the homepage URL box: start automatically, as soon as the captcha (if any) has answered.
  useEffect(() => {
    if (auto !== "waiting" || busy) return;
    if (captcha && !token) return;
    setAuto("done");
    setAutoStarted(true);
    void run(initialUrl);
  }, [auto, initialUrl, captcha, token, busy, run]);

  // Still waiting for the security check after a few seconds: it probably needs a tick from the person.
  useEffect(() => {
    if (auto !== "waiting") return;
    const t = window.setTimeout(() => setSecuritySlow(true), SECURITY_HINT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [auto]);

  // Result in: bring the score into view (no animation for people who asked for reduced motion) and tell the
  // page so the long explanations below fold away.
  const hasResult = result !== null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail: { shown: hasResult } }));
    if (!hasResult) return;
    const el = resultRef.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }, [hasResult]);

  const waiting = auto === "waiting" && !busy;
  const showSecurityStep = captcha && (waiting || (busy && autoStarted));
  const stepIndex = STEPS.reduce((i, st, n) => (elapsed >= st.after ? n : i), 0);
  const steps = [
    ...(showSecurityStep ? [{ id: "security", label: s.steps.security, status: waiting ? ("active" as const) : ("done" as const) }] : []),
    ...STEPS.map((st, n) => ({
      id: st.id,
      label: s.steps[st.id],
      // Waiting with no captcha lasts only until the page wakes up: show the first step as already under way.
      status: waiting ? (n === 0 && !captcha ? ("active" as const) : ("pending" as const)) : n < stepIndex ? ("done" as const) : n === stepIndex ? ("active" as const) : ("pending" as const),
    })),
  ];

  return (
    <div className="space-y-10">
      {formOpen && (
        <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAuto("done");
              setAutoStarted(false);
              void run(url);
            }}
            className="space-y-5"
            noValidate
          >
            <Field label={s.fieldLabel} htmlFor="fc-url" hint={s.fieldHint} error={error}>
              <Input
                id="fc-url"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                lang="en"
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
              <p className="text-xs text-muted">{s.footnote}</p>
              <Button
                type="submit"
                size="lg"
                loading={busy}
                loadingText={s.checking}
                icon={result ? <RotateCcw /> : undefined}
                iconRight={result ? undefined : <ArrowRight />}
              >
                {result ? s.runAgain : s.run}
              </Button>
            </div>
          </form>

          {(busy || waiting) && (
            <div className="mt-6 border-t border-border pt-6" role="status" aria-live="polite">
              <ProgressSteps label={s.progressLabel} steps={steps} />
              <p className="mt-4 text-xs text-muted">{waiting ? (securitySlow ? s.securityTick : s.securityWaiting) : s.duration}</p>
            </div>
          )}
        </Card>
      )}

      <div ref={resultRef} tabIndex={-1} className="scroll-mt-24 outline-none">
        {result && (
          <FreeCheckResultView
            result={result}
            lang={lang}
            bookHref={bookHref}
            onCheckAnother={() => {
              setFormOpen(true);
              setResult(null);
              setUrl("");
              setError(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Wraps the long explanations under the tool ("Three places…", "What we check", the questions). They stay in the
 * page's HTML for search engines and for visitors who have not run a check; once a result is on screen they are
 * hidden so the result and its buttons are not pushed away by reading matter.
 */
export function HideWhenFreeCheckResult({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setShown(Boolean((e as CustomEvent<{ shown?: boolean }>).detail?.shown));
    window.addEventListener(RESULT_EVENT, on);
    return () => window.removeEventListener(RESULT_EVENT, on);
  }, []);
  return <div hidden={shown}>{children}</div>;
}
