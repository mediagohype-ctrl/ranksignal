"use client";
// Interactive free website check: URL + invisible captcha → POST /api/public/free-check → result.
// Opened with the website already filled in (?url=… from the homepage box), there is no form at all: the progress
// steps show at once and the check starts by itself — straight away with the security token the homepage made, or
// as soon as this page's own invisible security check answers. Nothing red is ever shown while that is pending.
// When the result is in, the page scrolls to the score and the long explanations below (HideWhenFreeCheckResult)
// are hidden so the result and its buttons stay in view. A failed check is never a dead end: it offers the
// WhatsApp box (our team runs it by hand). The hourly limit explains how to start the free trial in three steps.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { preconnect, preload } from "react-dom";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, LinkButton, ProgressSteps, fieldDescribedBy } from "@/components/ui";
import { Turnstile, TURNSTILE_SCRIPT_SRC, isTurnstileConfigured, takeTokenHandoff } from "@/components/turnstile";
import { readAttribution } from "@/lib/attribution";
import { freeCheckStrings, type FreeCheckLang, type FreeCheckStrings } from "@/lib/free-check/strings";
import { resultHost, signupHref } from "@/lib/free-check/share";
import type { FreeCheckResult } from "@/lib/free-check/types";
import { track, trackOnce } from "@/lib/track";
import { FreeCheckResultView, WhatsAppBox } from "./free-check-result";

const STEPS = [
  { id: "home", after: 0 },
  { id: "robots", after: 4_000 },
  { id: "pages", after: 8_000 },
  { id: "score", after: 15_000 },
] as const;

/** How long a queued check waits silently for the security check before saying it may need a tap. */
const SECURITY_WAIT_MS = 8_000;

/** Fired on `window` when a result appears or is cleared, so server-rendered sections can fold away. */
const RESULT_EVENT = "mwr:free-check-result";
/** Fired on `window` while a check is queued or running (the WhatsApp chat bubble stays out of the way). */
export const BUSY_EVENT = "mwr:free-check-busy";

/** Errors where the website itself couldn't be read: offer the WhatsApp box instead of a dead end. */
const SITE_FAILURES = new Set(["unreachable", "timeout", "not_html"]);

type Failure = { code: string; message: string; url: string } | null;

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
  /** Field-level problem (bad address, network) shown under the box. */
  const [error, setError] = useState<string | null>(null);
  /** The site couldn't be read, or the hourly limit was reached: shown as a card, not a red line. */
  const [failure, setFailure] = useState<Failure>(null);
  const [result, setResult] = useState<FreeCheckResult | null>(null);
  // Arriving with a website filled in: no form, only the progress steps and then the result.
  const [formOpen, setFormOpen] = useState(!initialUrl.trim());
  /** Website waiting for the security token; the check starts by itself once it arrives. */
  const [queued, setQueued] = useState<string | null>(initialUrl.trim() ? initialUrl : null);
  const [securitySlow, setSecuritySlow] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const captcha = isTurnstileConfigured();

  // The security check must answer before the automatic start, so fetch its script as early as the page itself.
  if (captcha && initialUrl.trim()) {
    preconnect("https://challenges.cloudflare.com");
    preload(TURNSTILE_SCRIPT_SRC, { as: "script" });
  }

  // Token made on the homepage for this website: use it, and the check starts at once (no widget needed).
  const [handoffChecked, setHandoffChecked] = useState(false);
  useEffect(() => {
    if (captcha && initialUrl.trim()) {
      const handed = takeTokenHandoff(initialUrl);
      if (handed) setToken(handed);
    }
    setHandoffChecked(true);
  }, [captcha, initialUrl]);

  const run = useCallback(
    async (target: string) => {
      setBusy(true);
      setError(null);
      setFailure(null);
      setResult(null);
      setElapsed(0);
      const host = resultHost(target.trim().startsWith("http") ? target.trim() : `https://${target.trim()}`);
      track("check_started", { website: host, lang }, { name: "StartCheck" });
      const started = Date.now();
      const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
      try {
        const res = await fetch("/api/public/free-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target.trim(), turnstileToken: token || undefined, attribution: readAttribution() }),
        });
        const data = (await res.json().catch(() => null)) as {
          item?: FreeCheckResult;
          error?: { code?: string; message?: string; details?: { scope?: string } };
        } | null;
        if (!res.ok || !data?.item) {
          const code = data?.error?.code ?? "error";
          const message = s.serverError(code) ?? (code === "validation_error" ? s.errEmptyUrl : data?.error?.message) ?? s.errGeneric;
          track("check_failed", { website: host, reason: code });
          if (SITE_FAILURES.has(code) || (code === "rate_limited" && data?.error?.details?.scope !== "global")) {
            setFailure({ code, message, url: target.trim() });
          } else {
            setError(message);
          }
          setFormOpen(true);
        } else {
          setResult(data.item);
          setFormOpen(false);
          const leadId = data.item.leadId;
          trackOnce(
            `check-${leadId ?? host}`,
            "check_completed",
            { website: host, score: data.item.overall.score ?? undefined },
            // Same event id as the server's ViewContent, so Meta counts it once.
            leadId ? { name: "ViewContent", eventId: `check-${leadId}` } : undefined,
          );
        }
      } catch {
        setError(s.errNetwork);
        setFormOpen(true);
        track("check_failed", { website: host, reason: "network" });
      } finally {
        window.clearInterval(timer);
        setBusy(false);
        // Captcha tokens are single-use: get a fresh widget for the next attempt.
        setToken("");
        setWidgetKey((k) => k + 1);
      }
    },
    [token, s, lang],
  );

  // Start a queued check as soon as the security token is in (at once when there is no captcha).
  useEffect(() => {
    if (!queued || busy) return;
    if (captcha && !token) return;
    const target = queued;
    setQueued(null);
    setSecuritySlow(false);
    void run(target);
  }, [queued, captcha, token, busy, run]);

  // Still no token after 8 seconds: the invisible check probably needs a tap — say so calmly (never in red).
  useEffect(() => {
    if (!queued) return;
    const t = window.setTimeout(() => setSecuritySlow(true), SECURITY_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [queued]);

  // Tell the page while a check is queued or running (the chat bubble keeps clear of the progress and buttons).
  const active = busy || queued !== null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: { busy: active } }));
  }, [active]);
  useEffect(() => () => void window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: { busy: false } })), []);

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

  const waiting = queued !== null && !busy;
  const showSecurityStep = captcha && waiting;
  const stepIndex = STEPS.reduce((i, st, n) => (elapsed >= st.after ? n : i), 0);
  const steps = [
    ...(showSecurityStep ? [{ id: "security", label: s.steps.security, status: "active" as const }] : []),
    ...STEPS.map((st, n) => ({
      id: st.id,
      label: s.steps[st.id],
      status: waiting ? (n === 0 && !captcha ? ("active" as const) : ("pending" as const)) : n < stepIndex ? ("done" as const) : n === stepIndex ? ("active" as const) : ("pending" as const),
    })),
  ];

  // One invisible security widget, wherever the visitor is (form or progress card). Not needed while a token is held.
  const widget = handoffChecked && !token && !busy ? <Turnstile key={widgetKey} invisible onToken={setToken} action="free_check" className="flex justify-center empty:hidden" /> : null;

  const progress = (busy || waiting) && (
    <div role="status" aria-live="polite">
      <ProgressSteps label={s.progressLabel} steps={steps} />
      <p className="mt-4 text-xs text-muted">{waiting ? (securitySlow ? s.securityTick : s.securityWaiting) : s.duration}</p>
    </div>
  );

  return (
    <div className="space-y-10">
      {failure && (
        <div className="mx-auto max-w-2xl">
          {failure.code === "rate_limited" ? <LimitCard url={failure.url} s={s} /> : <FailureCard failure={failure} lang={lang} s={s} />}
        </div>
      )}

      {!formOpen && !result && (busy || waiting) && (
        <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
          <p className="mb-5 break-words text-small font-semibold text-fg">{s.checkedFor(resultHost(queued ?? url).replace(/^https?:\/\//, ""))}</p>
          {progress}
          {widget}
        </Card>
      )}

      {formOpen && (
        <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!url.trim()) {
                setError(s.errEmptyUrl);
                return;
              }
              setError(null);
              setFailure(null);
              // Never an error while the security check is still answering: queue it, it starts by itself.
              setQueued(url);
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
                disabled={busy || waiting}
                aria-describedby={fieldDescribedBy("fc-url", { hint: true, error })}
              />
            </Field>
            {widget}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">{s.footnote}</p>
              <Button
                type="submit"
                size="lg"
                loading={busy || waiting}
                loadingText={s.checking}
                icon={result || failure ? <RotateCcw /> : undefined}
                iconRight={result || failure ? undefined : <ArrowRight />}
              >
                {result || failure ? s.runAgain : s.run}
              </Button>
            </div>
          </form>

          {progress && <div className="mt-6 border-t border-border pt-6">{progress}</div>}
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

/** Hourly limit reached: how to start the free trial, in three easy steps, with one big button. */
function LimitCard({ url, s }: { url: string; s: FreeCheckStrings }) {
  return (
    <section aria-labelledby="fc-limit" className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8" role="status">
      <h2 id="fc-limit" className="text-h4 text-fg">
        {s.limitTitle}
      </h2>
      <p className="mt-2 text-small text-fg-soft">{s.limitIntro}</p>
      <ol className="mt-5 space-y-3">
        {s.limitSteps.map((step, n) => (
          <li key={step} className="flex items-start gap-3 text-small text-fg">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-small font-semibold text-primary-fg">
              {n + 1}
            </span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
      <LinkButton
        href={signupHref(url)}
        size="lg"
        className="mt-6 w-full sm:w-auto"
        icon={<Sparkles />}
        onClick={() => track("trial_click", { from: "free_check_limit" })}
      >
        {s.limitCta}
      </LinkButton>
      <p className="mt-3 text-xs text-muted">{s.limitLater}</p>
    </section>
  );
}

/** The site couldn't be read: get the report on WhatsApp instead (our team runs it by hand). */
function FailureCard({ failure, lang, s }: { failure: NonNullable<Failure>; lang: FreeCheckLang; s: FreeCheckStrings }) {
  return (
    <section aria-labelledby="fc-fail" className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h2 id="fc-fail" className="text-h4 text-fg">
        {s.failTitle}
      </h2>
      <p className="mt-2 text-small text-fg-soft">{s.failBody}</p>
      <p className="mt-1 text-xs text-muted">{failure.message}</p>
      <div className="mt-5">
        <WhatsAppBox website={failure.url} failure={failure.code} lang={lang} s={s} bare />
      </div>
    </section>
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
