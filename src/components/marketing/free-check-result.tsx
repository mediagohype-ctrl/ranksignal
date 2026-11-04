"use client";
// Result of the free website check: one score, the top 3 fixes, the rest blurred behind an email box,
// and a button to see every fix in the free trial.
import { useState } from "react";
import { ArrowRight, Info, Lock, Mail } from "lucide-react";
import { Button, Card, Field, IssueCard, Input, LinkButton, SCORE_BAND_CLASS, ScoreRing, SectionHeading, fieldDescribedBy, scoreBand } from "@/components/ui";
import { AI_VISIBILITY_NOTE, FREE_PILLAR_NAMES, type FreeCheckResult } from "@/lib/free-check/types";
import { TRIAL_DAYS } from "./plans";

export function signupHref(url: string) {
  return `/signup?website=${encodeURIComponent(url)}`;
}

/** "51 / 100 · Needs work" (or "Not checked yet"). */
export function scoreLine(score: number | null) {
  const band = scoreBand(score);
  return band === "none" ? SCORE_BAND_CLASS.none.label : `${Math.round(score as number)} / 100 · ${SCORE_BAND_CLASS[band].label}`;
}

export function FreeCheckResultView({ result }: { result: FreeCheckResult }) {
  const host = (() => {
    try {
      return new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      return result.url;
    }
  })();
  const hidden = Math.max(0, result.totalIssues - result.issues.length);
  const pages = result.pagesChecked.length;

  return (
    <div className="animate-fade-in space-y-10" aria-live="polite">
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
          <ScoreRing score={result.overall.score} size="lg" label="Your website score" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow break-words">Free website check · {host}</p>
            <h2 className="mt-2 text-balance text-h2 text-fg">{scoreLine(result.overall.score)}</h2>
            <p className="mt-3 text-small text-muted">
              Based on {pages} page{pages === 1 ? "" : "s"} we read just now
              {result.brand ? <> for <strong className="font-semibold text-fg">{result.brand}</strong></> : null}.
            </p>
          </div>
        </div>
        <p className="mt-6 flex gap-2 rounded-xl bg-surface-2 px-4 py-3 text-small text-fg-soft">
          <Info aria-hidden size={18} className="mt-0.5 shrink-0 text-primary" />
          {AI_VISIBILITY_NOTE}
        </p>
      </Card>

      <section aria-labelledby="fc-issues">
        <SectionHeading
          id="fc-issues"
          title={result.issues.length ? `Your top ${result.issues.length === 1 ? "fix" : `${result.issues.length} fixes`}` : "No big problems found"}
          description={
            result.issues.length
              ? "Most useful first, with the first steps for each one."
              : "Nice work — the pages we read cover the basics. The full check reads many more pages and asks ChatGPT about you."
          }
        />
        <div className="space-y-4">
          {result.issues.map((i, n) => (
            <IssueCard
              key={i.id}
              id={i.id}
              title={i.title}
              whatsWrong={i.whatsWrong}
              howToFix={i.howToFix}
              impact={i.impact}
              effort={i.effort}
              affectedCount={i.affectedCount}
              pillarLabel={FREE_PILLAR_NAMES[i.pillar] ?? i.pillarLabel}
              collapsible
              defaultOpen={n === 0}
            />
          ))}
        </div>
      </section>

      {hidden > 0 && <HiddenFixes count={hidden} leadId={result.leadId ?? null} />}

      <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center shadow-card sm:px-12">
        <h2 className="mx-auto max-w-2xl text-balance text-h3 text-fg">
          {hidden > 0 ? `See all ${result.totalIssues} fixes` : "See what ChatGPT says about you"}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-small text-muted">
          The full check reads your whole website, asks ChatGPT and Gemini the questions your customers ask, and gives
          you a step-by-step to-do list.
        </p>
        <div className="mt-6 flex justify-center">
          <LinkButton href={signupHref(result.url)} size="lg" iconRight={<ArrowRight />}>
            See all fixes free for {TRIAL_DAYS} days
          </LinkButton>
        </div>
        <p className="mt-4 text-xs text-muted">Nobody can promise a Google position or an AI mention. We measure honestly.</p>
      </div>
    </div>
  );
}

/** Blurred placeholders for the fixes the free check doesn't show, with the email box on top. */
function HiddenFixes({ count, leadId }: { count: number; leadId: string | null }) {
  const placeholders = Math.min(count, 3);
  return (
    <section aria-labelledby="fc-more" className="relative">
      <h2 id="fc-more" className="mb-4 text-h4 text-fg">
        +{count} more problem{count === 1 ? "" : "s"}
      </h2>
      <div aria-hidden className="pointer-events-none min-h-[18rem] select-none space-y-4 blur-[6px]">
        {Array.from({ length: placeholders }, (_, n) => (
          <div key={n} className="rounded-2xl border border-border bg-surface p-5">
            <div className="h-4 w-2/3 rounded bg-surface-3" />
            <div className="mt-3 h-3 w-full rounded bg-surface-2" />
            <div className="mt-2 h-3 w-5/6 rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center p-2 sm:p-4">
        {leadId ? (
          <EmailBox leadId={leadId} />
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-small font-medium text-fg shadow-lg">
            <Lock aria-hidden size={16} className="text-primary" />
            Shown in the full check
          </p>
        )}
      </div>
    </section>
  );
}

function EmailBox({ leadId }: { leadId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (saved) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-center shadow-xl" role="status">
        <Mail aria-hidden className="mx-auto text-primary" size={22} />
        <p className="mt-2 text-small font-semibold text-fg">Thanks — we&apos;ll email your full result to {saved}.</p>
        <p className="mt-1 text-xs text-muted">Want it now? Start the free trial below.</p>
      </div>
    );
  }

  return (
    <form
      className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const value = email.trim();
        if (!/^\S+@\S+\.\S+$/.test(value)) {
          setError("Enter a valid email address.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/public/free-check/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId, email: value }),
          });
          const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          if (!res.ok) setError(data?.error?.message ?? "Something went wrong. Please try again.");
          else setSaved(value);
        } catch {
          setError("We couldn't reach our server. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Email me my full result" htmlFor="fc-email" error={error}>
        <Input
          id="fc-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          invalid={!!error}
          disabled={busy}
          aria-describedby={fieldDescribedBy("fc-email", { error })}
        />
      </Field>
      <Button type="submit" className="mt-3 w-full" loading={busy} loadingText="Saving…" icon={<Mail />}>
        Email me my full result
      </Button>
      <p className="mt-2 text-xs text-muted">No spam. One email with your result, and you can say stop any time.</p>
    </form>
  );
}
