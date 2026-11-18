"use client";
// Result of the free website check, in this order (site audit, 15 Nov 2026):
// Found Score → the four scores → what this means → top 3 fixes (biggest gain first, each with its first steps) →
// locked "What does ChatGPT say about you?" box → "See all N fixes free" → email box → share buttons →
// "Our team will do it for you" card. Every word comes from src/lib/free-check/strings.ts (English and Hindi).
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, CalendarCheck, Gauge, Linkedin, Lock, Mail, MessageCircle, RotateCcw, Timer } from "lucide-react";
import { Button, Card, Field, Input, LinkButton, Meter, SCORE_BAND_CLASS, ScoreRing, SectionHeading, fieldDescribedBy, scoreBand, type ScoreBand } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { hindiFix } from "@/lib/free-check/hi-fixes";
import { addWebsiteHref, freeCheckLink, linkedinShareHref, resultHost, signupHref, whatsappShareHref } from "@/lib/free-check/share";
import { freeCheckStrings, type FreeCheckLang, type FreeCheckStrings, type ScoreBandKey } from "@/lib/free-check/strings";
import type { FreeCheckIssue, FreeCheckPillar, FreeCheckResult } from "@/lib/free-check/types";
import type { IssueEffort, IssueImpact } from "@/lib/report/types";
import { TRIAL_DAYS } from "./plans";

export { signupHref };

/** "51 / 100 · Needs work" (or "Not checked yet"). */
export function scoreLine(score: number | null, s: FreeCheckStrings = freeCheckStrings("en")) {
  const band = scoreBand(score);
  return band === "none" ? s.notChecked : `${Math.round(score as number)} / 100 · ${s.bandLabel[band]}`;
}

/** Where the main button goes: sign-up for visitors, the new-website flow for people who are already signed in. */
function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Asked from the browser so the page itself stays the same (and cacheable) for everyone.
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => {
        if (!cancelled && r.ok) setSignedIn(true);
      })
      .catch(() => {
        /* signed out or offline: keep the sign-up button */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return signedIn;
}

export function FreeCheckResultView({
  result,
  lang = "en",
  bookHref = "/contact?topic=services&tier=fix",
  onCheckAnother,
}: {
  result: FreeCheckResult;
  lang?: FreeCheckLang;
  /** "Book a free call" link (calendar when set, else the contact page). */
  bookHref?: string;
  /** Shows a "Check another website" button under the result. */
  onCheckAnother?: () => void;
}) {
  const s = freeCheckStrings(lang);
  const signedIn = useSignedIn();
  const host = resultHost(result.url);
  const hidden = Math.max(0, result.totalIssues - result.issues.length);
  const pages = result.pagesChecked.length;
  const gain = result.issues.reduce((a, i) => a + (i.points ?? 0), 0);
  const cta = signedIn ? { href: addWebsiteHref(result.url), label: s.addToAccount } : { href: signupHref(result.url), label: s.startTrial };
  const leadId = result.leadId ?? null;

  return (
    <div className="animate-fade-in space-y-10" aria-live="polite" lang={lang === "hi" ? "hi" : undefined}>
      {/* 1–3. Found Score, the four scores, what this means */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:gap-8 sm:text-left">
          <ScoreRing score={result.overall.score} size="lg" label={s.overallLabel} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow break-words">{s.eyebrow(host)}</p>
            <h2 className="mt-2 text-balance text-h2 text-fg">{scoreLine(result.overall.score, s)}</h2>
            <p className="mt-3 text-small text-muted">
              {s.basedOn(pages)}
              {result.brand ? (
                <>
                  {s.basedOnFor}
                  <strong className="font-semibold text-fg" lang="en">
                    {result.brand}
                  </strong>
                </>
              ) : null}
              {lang === "hi" ? "।" : "."}
            </p>
          </div>
        </div>

        {result.pillars.length > 0 && <PillarBreakdown pillars={result.pillars} s={s} />}
        <MeaningStrip score={result.overall.score} gain={gain} fixes={result.issues.length} s={s} />
      </Card>

      {/* 4. Top fixes */}
      <section aria-labelledby="fc-issues">
        <SectionHeading id="fc-issues" title={s.fixesTitle(result.issues.length)} description={result.issues.length ? s.fixesIntro : s.noFixesIntro} />
        {result.issues.length > 0 && (
          <ol className="space-y-6">
            {result.issues.map((i, n) => (
              <FixCard key={i.id} issue={i} n={n + 1} lang={lang} s={s} />
            ))}
          </ol>
        )}
        {gain > 0 && <p className="mt-4 text-xs text-muted">{s.pointsNote}</p>}
      </section>

      {/* 5. Locked: what ChatGPT says (the free check never asks AI) */}
      <section aria-labelledby="fc-chatgpt" className="rounded-2xl border border-dashed border-border-strong bg-surface-2/60 px-5 py-8 sm:px-10">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
              <Lock size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="fc-chatgpt" className="text-h4 text-fg">
                {s.lockedTitle} {s.lockedBody(TRIAL_DAYS)}
              </h2>
              <p className="mt-1 text-small text-muted">{s.lockedNote}</p>
            </div>
          </div>
          <LinkButton href={cta.href} variant="outline" iconRight={<ArrowRight />} className="shrink-0">
            {signedIn ? s.addToAccount : s.lockedCta}
          </LinkButton>
        </div>
      </section>

      {/* 6. See all N fixes */}
      <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center shadow-card sm:px-12">
        <h2 className="mx-auto max-w-2xl text-balance text-h3 text-fg">{s.seeAllTitle(result.totalIssues, TRIAL_DAYS)}</h2>
        <p className="mx-auto mt-3 max-w-xl text-small text-muted">{s.seeAllBody}</p>
        <div className="mt-6 flex justify-center">
          <LinkButton href={cta.href} size="lg" iconRight={<ArrowRight />}>
            {cta.label}
          </LinkButton>
        </div>
        {signedIn && <p className="mt-3 text-xs text-muted">{s.addToAccountNote}</p>}
        <p className="mt-4 text-xs text-muted">{s.noPromise}</p>
      </div>

      {/* 7. Email box (over the blurred fixes that are not shown) */}
      {(hidden > 0 || leadId) && <HiddenFixes count={hidden} leadId={leadId} s={s} />}

      {/* 8. Share */}
      <ShareRow result={result} host={host} lang={lang} s={s} />

      {/* 9. Our team will do it for you */}
      <section aria-labelledby="fc-team" className="rounded-2xl bg-fg px-5 py-10 text-bg sm:px-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 id="fc-team" className="max-w-2xl text-balance text-h3 text-bg">
              {s.teamTitle}
            </h2>
            <p className="mt-3 max-w-xl text-small text-bg/75">{s.teamBody}</p>
          </div>
          <a
            href={bookHref}
            {...(/^https?:\/\//.test(bookHref) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-bg px-6 text-base font-medium text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bg [&_svg]:size-5"
          >
            <CalendarCheck aria-hidden />
            {s.bookCall}
          </a>
        </div>
      </section>

      {onCheckAnother && (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" icon={<RotateCcw />} onClick={onCheckAnother}>
            {s.checkAnother}
          </Button>
        </div>
      )}
    </div>
  );
}

const chip = "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none";
const IMPACT_CLS: Record<IssueImpact, string> = { high: "bg-danger-soft text-danger", medium: "bg-warning-soft text-warning", low: "bg-info-soft text-info" };
const EFFORT_CLS: Record<IssueEffort, string> = { quick: "bg-success-soft text-success", moderate: "bg-surface-2 text-fg-soft", involved: "bg-surface-2 text-fg-soft" };

/** One fix: what's wrong and its first steps, always open (every fix shows its steps, not only the first). */
function FixCard({ issue, n, lang, s }: { issue: FreeCheckIssue; n: number; lang: FreeCheckLang; s: FreeCheckStrings }) {
  const text = lang === "hi" ? hindiFix(issue) : { title: issue.title, whatsWrong: issue.whatsWrong, howToFix: issue.howToFix, translated: true };
  // A fix we have no Hindi for is shown in English, and marked as English for screen readers.
  const textLang = lang === "hi" && !text.translated ? "en" : undefined;
  return (
    <li className="relative">
      <div className="absolute -top-3 left-5 z-10 flex items-center gap-1.5 sm:left-6">
        <span className="inline-flex h-6 items-center rounded-full bg-fg px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-bg">
          {s.fixN(n)}
        </span>
        {issue.points ? (
          <span className="inline-flex h-6 items-center rounded-full bg-score-good-soft px-2.5 text-xs font-semibold tabular-nums text-score-good ring-1 ring-score-good/25">
            <span className="sr-only">{s.pointsSr}</span>
            {s.points(issue.points)}
          </span>
        ) : null}
      </div>
      <Card as="article" id={issue.id} className="px-5 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-8">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className={clsx(chip, IMPACT_CLS[issue.impact] ?? IMPACT_CLS.low)}>
            <Gauge aria-hidden size={12} />
            {s.impact[issue.impact] ?? s.impact.low}
          </span>
          <span className={clsx(chip, EFFORT_CLS[issue.effort] ?? EFFORT_CLS.moderate)}>
            <Timer aria-hidden size={12} />
            {s.effort[issue.effort] ?? s.effort.moderate}
          </span>
          <span className={clsx(chip, "border border-border text-muted")}>{s.pillarName[issue.pillar] ?? issue.pillarLabel}</span>
        </div>
        <h3 className="text-h4 text-fg" lang={textLang}>
          {text.title}
        </h3>
        {issue.affectedCount > 0 && <p className="mt-0.5 text-xs text-muted">{s.affects(issue.affectedCount)}</p>}
        <div className="mt-4 space-y-4 text-small leading-relaxed text-fg-soft">
          {text.whatsWrong && (
            <section>
              <h4 className="mb-1 text-caption uppercase tracking-[0.06em] text-muted">{s.whatsWrong}</h4>
              <p lang={textLang}>{text.whatsWrong}</p>
            </section>
          )}
          {text.howToFix.length > 0 && (
            <section>
              <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-muted">{s.firstSteps}</h4>
              <ol className="space-y-2" lang={textLang}>
                {text.howToFix.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">
                      <span className="sr-only">{s.stepSr(i + 1)}</span>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">{s.moreSteps}</p>
            </section>
          )}
        </div>
      </Card>
    </li>
  );
}

/** The four area scores as labelled bars, each number and sentence as real text. */
function PillarBreakdown({ pillars, s }: { pillars: FreeCheckPillar[]; s: FreeCheckStrings }) {
  return (
    <figure className="mt-8 border-t border-border pt-6">
      <h3 className="text-h4 text-fg">{s.fourScores}</h3>
      <figcaption className="mt-1 text-small text-muted">{s.fourScoresCaption}</figcaption>
      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pillars.map((p) => {
          const band = scoreBand(p.score);
          const name = s.pillarName[p.pillar] ?? p.label;
          const aiArea = p.pillar === "geo" || p.pillar === "brand";
          return (
            <li key={p.pillar} className="rounded-xl border border-border bg-surface-2/50 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-small font-semibold text-fg">{name}</p>
                <p className="shrink-0 text-small tabular-nums text-fg">
                  {band === "none" ? (
                    <span className="text-muted">{s.fullCheckOnly}</span>
                  ) : (
                    <>
                      <span className="font-semibold">{Math.round(p.score as number)}</span>
                      <span className="text-muted"> / 100 · </span>
                      <span className={clsx("font-medium", SCORE_BAND_CLASS[band].text)}>{s.bandLabel[band]}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="mt-2.5">
                {band === "none" ? (
                  <div aria-hidden className="h-2.5 w-full rounded-full border border-dashed border-border-strong" />
                ) : (
                  <Meter value={Math.round(p.score as number)} max={100} label={s.meterLabel(name)} tone="score" size="md" />
                )}
              </div>
              <p className="mt-3 text-small font-medium text-fg-soft">{s.pillarQuestion[p.pillar]}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {band === "none"
                  ? aiArea
                    ? s.notMeasuredAi
                    : s.notMeasured
                  : // A server from before this field existed (mid-deploy) sends no counts: use its own sentence.
                    p.counts
                    ? s.pillarSummary(band, p.counts.pass, p.counts.total, p.counts.fail)
                    : p.summary}
                {/* The free check never asks AI: say what the number covers, never "waiting for AI results". */}
                {band !== "none" && aiArea ? <> {s.websiteOnly}</> : null}
              </p>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

const BANDS: { band: ScoreBandKey; range: string; width: number }[] = [
  { band: "poor", range: "0–49", width: 50 },
  { band: "ok", range: "50–74", width: 25 },
  { band: "good", range: "75–100", width: 25 },
];

/** "What this means": where the score sits on the Poor / Needs work / Good scale, and where the top fixes could take it. */
function MeaningStrip({ score, gain, fixes, s }: { score: number | null; gain: number; fixes: number; s: FreeCheckStrings }) {
  const band: ScoreBand = scoreBand(score);
  if (band === "none") return null;
  const now = Math.max(0, Math.min(100, Math.round(score as number)));
  const after = Math.min(100, now + gain);
  const clampPct = (n: number) => Math.max(6, Math.min(94, n));
  return (
    <figure className="mt-8 border-t border-border pt-6">
      <h3 className="text-h4 text-fg">{s.meaning}</h3>
      <figcaption className="mt-1 text-small text-muted">{s.meaningCaption}</figcaption>
      <div aria-hidden className="relative mt-9 h-16">
        <div className="absolute inset-x-0 top-0 flex h-3 overflow-hidden rounded-full">
          {BANDS.map((b) => (
            <span key={b.band} className={SCORE_BAND_CLASS[b.band].soft} style={{ width: `${b.width}%` }} />
          ))}
        </div>
        {after > now && <span className="absolute top-0 h-3 rounded-full bg-score-good/45" style={{ left: `${now}%`, width: `${after - now}%` }} />}
        <span className={clsx("absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full", SCORE_BAND_CLASS[band].bg)} style={{ left: `${now}%` }} />
        <span
          className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-full bg-fg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-bg"
          style={{ left: `${clampPct(now)}%` }}
        >
          {s.you(now)}
        </span>
        <div className="absolute inset-x-0 top-5 flex text-[11px] leading-tight text-muted">
          {BANDS.map((b) => (
            <span key={b.band} className="min-w-0 pr-1" style={{ width: `${b.width}%` }}>
              <span className="block font-medium text-fg-soft">{s.bandLabel[b.band]}</span>
              {b.range}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-small leading-relaxed text-fg-soft">
        <strong className="font-semibold text-fg">{s.inRange(now, band)}</strong> {s.bandMeaning[band]}
        {after > now && <> {s.couldAdd(fixes, after - now, after)}</>}
        {now < 75 && <> {s.goodAway(75 - now)}</>}
      </p>
    </figure>
  );
}

/** The email box. When some fixes are not shown it sits on top of blurred placeholders for them. */
function HiddenFixes({ count, leadId, s }: { count: number; leadId: string | null; s: FreeCheckStrings }) {
  const box = leadId ? (
    <EmailBox leadId={leadId} s={s} />
  ) : (
    <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-small font-medium text-fg shadow-lg">
      <Lock aria-hidden size={16} className="text-primary" />
      {s.lockedInFull}
    </p>
  );
  if (count === 0) return <section aria-label={s.emailLabel} className="flex justify-center">{box}</section>;
  const placeholders = Math.min(count, 3);
  return (
    <section aria-labelledby="fc-more" className="relative">
      <h2 id="fc-more" className="mb-4 text-h4 text-fg">
        {s.moreFixes(count)}
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
      <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center p-2 sm:p-4">{box}</div>
    </section>
  );
}

function EmailBox({ leadId, s }: { leadId: string; s: FreeCheckStrings }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (saved) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-center shadow-xl" role="status">
        <Mail aria-hidden className="mx-auto text-primary" size={22} />
        <p className="mt-2 text-small font-semibold text-fg">{s.emailThanks(saved)}</p>
        <p className="mt-1 text-xs text-muted">{s.emailThanksNext}</p>
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
          setError(s.emailInvalid);
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
          const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
          if (res.ok) setSaved(value);
          else {
            const code = data?.error?.code;
            // Every error says what to do next: fix the address, run the check again, or start the trial.
            // "Invalid input" (the server's wording for a bad address) and a missing message get our own line.
            setError(s.emailServerError(code) ?? (code === "validation_error" ? s.emailInvalid : data?.error?.message) ?? s.emailFailed);
          }
        } catch {
          setError(s.emailNetwork);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={s.emailLabel} htmlFor="fc-email" error={error}>
        <Input
          id="fc-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          lang="en"
          placeholder={s.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          invalid={!!error}
          disabled={busy}
          aria-describedby={fieldDescribedBy("fc-email", { error })}
        />
      </Field>
      <Button type="submit" className="mt-3 w-full" loading={busy} loadingText={s.emailSaving} icon={<Mail />}>
        {s.emailLabel}
      </Button>
      <p className="mt-2 text-xs text-muted">{s.emailNote}</p>
    </form>
  );
}

/** "Share on WhatsApp" / "Share on LinkedIn": the score in a ready-typed message, with a link back to the free check for this site. */
function ShareRow({ result, host, lang, s }: { result: FreeCheckResult; host: string; lang: FreeCheckLang; s: FreeCheckStrings }) {
  // The result only ever renders in the browser (after the check), so the page's own address is known here.
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const score = result.overall.score === null ? null : Math.round(result.overall.score);
  const message = s.shareMessage(host, score, BRAND.name, freeCheckLink(base, result.url, lang));
  return (
    <section aria-labelledby="fc-share" className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="min-w-0">
        <h2 id="fc-share" className="text-h4 text-fg">
          {s.shareTitle}
        </h2>
        <p className="mt-1 text-small text-muted">{s.shareBody}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <LinkButton href={whatsappShareHref(message)} external variant="outline" icon={<MessageCircle />}>
          {s.shareWhatsapp}
        </LinkButton>
        <LinkButton href={linkedinShareHref(message)} external variant="outline" icon={<Linkedin />}>
          {s.shareLinkedin}
        </LinkButton>
      </div>
    </section>
  );
}
