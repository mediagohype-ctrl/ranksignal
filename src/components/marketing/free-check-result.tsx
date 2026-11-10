"use client";
// Result of the free website check: one score, the four area scores, what the score means, the top 3 fixes with
// "+N points", the rest blurred behind an email box, and a button to see every fix in the free trial.
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, Info, Lock, Mail } from "lucide-react";
import { Button, Card, Field, IssueCard, Input, LinkButton, Meter, SCORE_BAND_CLASS, ScoreRing, SectionHeading, fieldDescribedBy, scoreBand, type ScoreBand } from "@/components/ui";
import { AI_VISIBILITY_NOTE, FREE_PILLAR_NAMES, type FreeCheckPillar, type FreeCheckResult } from "@/lib/free-check/types";
import type { Pillar } from "@/lib/report/types";
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
  const gain = result.issues.reduce((a, i) => a + (i.points ?? 0), 0);

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

        {result.pillars.length > 0 && <PillarBreakdown pillars={result.pillars} />}
        <MeaningStrip score={result.overall.score} gain={gain} fixes={result.issues.length} />

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
        <ol className="space-y-6">
          {result.issues.map((i, n) => (
            <li key={i.id} className="relative">
              <div className="absolute -top-3 left-5 z-10 flex items-center gap-1.5 sm:left-6">
                <span className="inline-flex h-6 items-center rounded-full bg-fg px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-bg">
                  Fix {n + 1}
                </span>
                {i.points ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-score-good-soft px-2.5 text-xs font-semibold tabular-nums text-score-good ring-1 ring-score-good/25">
                    <span className="sr-only">Could add about </span>
                    {pointsLabel(i.points)}
                  </span>
                ) : null}
              </div>
              <IssueCard
                id={i.id}
                className="pt-7 sm:pt-8"
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
            </li>
          ))}
        </ol>
        {gain > 0 && (
          <p className="mt-4 text-xs text-muted">
            Points are our estimate of how much your score here would rise after each fix. They are not a promise of a
            Google position or an AI mention.
          </p>
        )}
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

/** "+1 point" / "+4 points" (same wording as the full report). */
function pointsLabel(n: number) {
  return `+${n} ${n === 1 ? "point" : "points"}`;
}

/** Plain-English question each score answers. */
const PILLAR_QUESTION: Record<Pillar, string> = {
  seo: "Can Google find and show your pages?",
  aeo: "Do your pages answer questions clearly enough to be quoted?",
  geo: "Can AI assistants like ChatGPT read and understand you?",
  brand: "Are your business details easy to find and trust?",
};

/** The four area scores as labelled bars, each number and sentence as real text. */
function PillarBreakdown({ pillars }: { pillars: FreeCheckPillar[] }) {
  return (
    <figure className="mt-8 border-t border-border pt-6">
      <h3 className="text-h4 text-fg">Your four scores</h3>
      <figcaption className="mt-1 text-small text-muted">Each area is scored from 0 to 100. Green is good, yellow needs work, red is poor.</figcaption>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {pillars.map((p) => {
          const band = scoreBand(p.score);
          const name = FREE_PILLAR_NAMES[p.pillar] ?? p.label;
          return (
            <li key={p.pillar} className="rounded-xl border border-border bg-surface-2/50 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-small font-semibold text-fg">{name}</p>
                <p className="shrink-0 text-small tabular-nums text-fg">
                  {band === "none" ? (
                    <span className="text-muted">Full check</span>
                  ) : (
                    <>
                      <span className="font-semibold">{Math.round(p.score as number)}</span>
                      <span className="text-muted"> / 100 · </span>
                      <span className={clsx("font-medium", SCORE_BAND_CLASS[band].text)}>{SCORE_BAND_CLASS[band].label}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="mt-2.5">
                {band === "none" ? (
                  <div aria-hidden className="h-2.5 w-full rounded-full border border-dashed border-border-strong" />
                ) : (
                  <Meter value={Math.round(p.score as number)} max={100} label={`${name} score`} tone="score" size="md" />
                )}
              </div>
              <p className="mt-3 text-small font-medium text-fg-soft">{PILLAR_QUESTION[p.pillar]}</p>
              {p.summary && <p className="mt-1 text-xs leading-relaxed text-muted">{p.summary}</p>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

const BAND_MEANING: Record<Exclude<ScoreBand, "none">, string> = {
  poor: "Google and AI assistants struggle to understand your website. The fixes below are the quickest way up.",
  ok: "Some of the basics are in place, but gaps make it harder for Google and AI to pick you.",
  good: "Your pages cover the basics well. The full check looks for the next wins, including what ChatGPT says about you.",
};

const BANDS = [
  { band: "poor", label: "Poor", range: "0–49", width: 50 },
  { band: "ok", label: "Needs work", range: "50–74", width: 25 },
  { band: "good", label: "Good", range: "75–100", width: 25 },
] as const;

/** "What this means": where the score sits on the Poor / Needs work / Good scale, and where the top fixes could take it. */
function MeaningStrip({ score, gain, fixes }: { score: number | null; gain: number; fixes: number }) {
  const band = scoreBand(score);
  if (band === "none") return null;
  const now = Math.max(0, Math.min(100, Math.round(score as number)));
  const after = Math.min(100, now + gain);
  const clampPct = (n: number) => Math.max(6, Math.min(94, n));
  return (
    <figure className="mt-8 border-t border-border pt-6">
      <h3 className="text-h4 text-fg">What this means</h3>
      <figcaption className="mt-1 text-small text-muted">
        Where your score sits: Poor is below 50, Needs work is 50 to 74, Good is 75 and up.
      </figcaption>
      <div aria-hidden className="relative mt-9 h-16">
        <div className="absolute inset-x-0 top-0 flex h-3 overflow-hidden rounded-full">
          {BANDS.map((b) => (
            <span key={b.band} className={SCORE_BAND_CLASS[b.band].soft} style={{ width: `${b.width}%` }} />
          ))}
        </div>
        {after > now && (
          <span
            className="absolute top-0 h-3 rounded-full bg-score-good/45"
            style={{ left: `${now}%`, width: `${after - now}%` }}
          />
        )}
        <span className={clsx("absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full", SCORE_BAND_CLASS[band].bg)} style={{ left: `${now}%` }} />
        <span
          className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-full bg-fg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-bg"
          style={{ left: `${clampPct(now)}%` }}
        >
          You: {now}
        </span>
        <div className="absolute inset-x-0 top-5 flex text-[11px] leading-tight text-muted">
          {BANDS.map((b) => (
            <span key={b.band} className="min-w-0 pr-1" style={{ width: `${b.width}%` }}>
              <span className="block font-medium text-fg-soft">{b.label}</span>
              {b.range}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-small leading-relaxed text-fg-soft">
        <strong className="font-semibold text-fg">
          Your score of {now} is in the {SCORE_BAND_CLASS[band].label} range.
        </strong>{" "}
        {BAND_MEANING[band]}
        {after > now && (
          <>
            {" "}
            Your top {fixes === 1 ? "fix" : `${fixes} fixes`} could add about {after - now} points, taking you to around {after}.
          </>
        )}
        {now < 75 && <> Good starts at 75, which is {75 - now} points away.</>}
      </p>
    </figure>
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
