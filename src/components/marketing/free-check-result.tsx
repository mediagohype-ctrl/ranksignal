"use client";
// Result of the free website check, in this order (simplified Nov 2026: fewer words, more visual):
// Found Score + one plain line → the four scores as rings → "now → after these fixes" bar graph → top 3 fixes as
// compact rows: fix 1 in full, fixes 2+ blurred under the WhatsApp box ("Your full report is ready") → one unlock card
// (all fixes, what ChatGPT says, weekly check) → share buttons → "Our team will do it for you" card. Every word comes from src/lib/free-check/strings.ts (English and Hindi).
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, CalendarCheck, Check, ChevronDown, CircleAlert, Linkedin, Lock, MessageCircle, RotateCcw, Timer, X as XIcon } from "lucide-react";
import { Button, Card, Field, Input, LinkButton, SCORE_BAND_CLASS, ScoreRing, SectionHeading, fieldDescribedBy, scoreBand, type ScoreBand } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { hindiFix } from "@/lib/free-check/hi-fixes";
import { addWebsiteHref, freeCheckLink, linkedinShareHref, loginHref, resultHost, signupHref, whatsappShareHref } from "@/lib/free-check/share";
import { freeCheckStrings, type FreeCheckLang, type FreeCheckStrings } from "@/lib/free-check/strings";
import type { FreeCheckBenchmark, FreeCheckIssue, FreeCheckLockedIssue, FreeCheckPillar, FreeCheckResult, FreeCheckSnapshot } from "@/lib/free-check/types";
import type { IssueEffort, IssueImpact } from "@/lib/report/types";
import { readAttribution } from "@/lib/attribution";
import { track } from "@/lib/track";
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
  const overallBand = scoreBand(result.overall.score);

  return (
    <div className="animate-fade-in space-y-8" aria-live="polite" lang={lang === "hi" ? "hi" : undefined}>
      {/* 1–3. Found Score, the four scores as rings, and a "now → after these fixes" bar graph. Few words. */}
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:gap-8 sm:text-left">
          <ScoreRing score={result.overall.score} size="lg" label={s.overallLabel} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow break-words">{s.eyebrow(host)}</p>
            <h2 className="mt-2 text-balance text-h2 text-fg">{scoreLine(result.overall.score, s)}</h2>
            {overallBand !== "none" && <p className="mt-2 text-body text-fg-soft">{s.bandShort[overallBand]}</p>}
            <p className="mt-2 text-xs text-muted">
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

        {result.pillars.length > 0 && <ScoreTiles pillars={result.pillars} s={s} />}
        <ScoreJourney score={result.overall.score} gain={gain} fixes={result.issues.length} s={s} />
        {result.benchmark && result.overall.score !== null && <BenchmarkBar b={result.benchmark} score={result.overall.score} s={s} />}
      </Card>

      {/* 2. Scan summary: big numbers, severity bar, the pages we read */}
      <ScanSummary result={result} s={s} />

      {/* 2b. Google preview, AI assistants, basics */}
      {result.snapshot && <AtAGlance snap={result.snapshot} host={host} s={s} />}

      {/* 4. Top fixes */}
      <section aria-labelledby="fc-issues">
        <SectionHeading id="fc-issues" title={s.fixesTitle(result.issues.length)} description={result.issues.length ? s.fixesIntro : s.noFixesIntro} />
        {result.issues.length > 0 && (
          <ol className="space-y-6">
            <FixCard issue={result.issues[0]!} n={1} lang={lang} s={s} />
          </ol>
        )}
        {/* Fixes 2+ blurred under one field: the WhatsApp number. Saving it unlocks them here and sends the report. */}
        {(result.issues.length > 1 || leadId) && (
          <LockedFixes issues={result.issues.slice(1)} leadId={leadId} website={result.url} lang={lang} s={s} />
        )}
        {gain > 0 && <p className="mt-4 text-xs text-muted">{s.pointsNote}</p>}
      </section>

      {/* 4b. More problems, by title only: the fix for each is in the full report */}
      {(result.moreIssues?.length ?? 0) > 0 && (
        <LockedProblems items={result.moreIssues!} total={hidden} ctaHref={cta.href} lang={lang} s={s} />
      )}

      {/* 4b2. Locked ChatGPT conversation, and a 30-day plan from this site's own counts */}
      <ChatPreview name={result.brand ?? host} ctaHref={cta.href} s={s} />
      {result.issueCounts && <PlanTimeline counts={result.issueCounts} ctaHref={cta.href} s={s} />}

      {/* 4c. Everything we checked, per area, and what already works */}
      {result.pillars.some((p) => p.checks.length > 0) && <CheckedAreas pillars={result.pillars} strengths={result.strengths} s={s} />}

      {/* 5–6. One unlock card: all fixes + what ChatGPT says (the free check never asks AI) + weekly check. */}
      <section aria-labelledby="fc-unlock" className="rounded-2xl border border-border bg-surface px-5 py-8 text-center shadow-card sm:px-10">
        <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg">
          <Lock size={22} />
        </span>
        <h2 id="fc-unlock" className="mx-auto mt-4 max-w-xl text-balance text-h3 text-fg">
          {s.seeAllTitle(result.totalIssues, TRIAL_DAYS)}
        </h2>
        <ul className="mx-auto mt-5 inline-grid gap-2.5 text-left text-small text-fg">
          {s.unlockList(result.totalIssues).map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-score-good-soft text-score-good">
                <Check size={13} strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-center">
          <LinkButton href={cta.href} size="lg" iconRight={<ArrowRight />}>
            {cta.label}
          </LinkButton>
        </div>
        {signedIn && <p className="mt-3 text-xs text-muted">{s.addToAccountNote}</p>}
        <p className="mt-4 text-xs text-muted">{s.noPromise}</p>
      </section>

<<<<<<< HEAD
=======
      {/* 7. Email box. The locked problems above now show real titles, so the blurred placeholders are only used when an
          older server sends no moreIssues. */}
      {(leadId || (hidden > 0 && !result.moreIssues)) && (
        <HiddenFixes
          count={result.moreIssues ? 0 : hidden}
          leadId={leadId}
          login={signedIn ? null : loginHref(result.url)}
          s={s}
        />
      )}

>>>>>>> eb3b71c1c7f6e3be7f98e3d19e6a6b9c216ea0d2
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
            onClick={() => track("call_booked", { from: "free_check" }, { name: "Schedule" })}
            {...(/^https?:\/\//.test(bookHref) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-bg px-6 text-base font-medium text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bg [&_svg]:size-5"
          >
            <CalendarCheck aria-hidden />
            {s.bookCall}
          </a>
        </div>
      </section>

      <StickyCta problems={result.totalIssues} href={cta.href} label={cta.label} s={s} />

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
const EFFORT_CLS: Record<IssueEffort, string> = { quick: "bg-success-soft text-success", moderate: "bg-surface-2 text-fg-soft", involved: "bg-surface-2 text-fg-soft" };
/** Impact as a tiny 3-bar signal (like phone signal bars): high = 3, medium = 2, low = 1. */
const IMPACT_LEVEL: Record<IssueImpact, number> = { high: 3, medium: 2, low: 1 };
const IMPACT_BAR: Record<IssueImpact, string> = { high: "bg-danger", medium: "bg-warning", low: "bg-info" };

function ImpactSignal({ impact, label }: { impact: IssueImpact; label: string }) {
  const level = IMPACT_LEVEL[impact] ?? 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-soft">
      <span aria-hidden className="inline-flex h-3.5 items-end gap-[2px]">
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className={clsx("w-[4px] rounded-sm", b <= level ? IMPACT_BAR[impact] ?? "bg-info" : "bg-surface-3")}
            style={{ height: `${b * 33}%` }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

/**
 * One fix, compact: number, short title, impact signal, effort and points. "How to fix" opens what's wrong and the
 * first steps (folded by default so the result stays short and easy to scan).
 */
function FixCard({ issue, n, lang, s }: { issue: FreeCheckIssue; n: number; lang: FreeCheckLang; s: FreeCheckStrings }) {
  const text = lang === "hi" ? hindiFix(issue) : { title: issue.title, whatsWrong: issue.whatsWrong, howToFix: issue.howToFix, translated: true };
  // A fix we have no Hindi for is shown in English, and marked as English for screen readers.
  const textLang = lang === "hi" && !text.translated ? "en" : undefined;
  return (
    <li>
      <Card as="article" id={issue.id} padding="none" className="overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-surface-2/50 sm:gap-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fg text-small font-semibold text-bg">
              {n}
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">{s.fixN(n)}: </span>
              <h3 className="text-[1.0625rem] font-semibold leading-snug text-fg" lang={textLang}>
                {text.title}
              </h3>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <ImpactSignal impact={issue.impact} label={s.impact[issue.impact] ?? s.impact.low} />
                <span className={clsx(chip, EFFORT_CLS[issue.effort] ?? EFFORT_CLS.moderate)}>
                  <Timer aria-hidden size={12} />
                  {s.effort[issue.effort] ?? s.effort.moderate}
                </span>
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {s.howToFix}
                <ChevronDown aria-hidden size={14} className="transition-transform group-open:rotate-180" />
              </span>
            </span>
            {issue.points ? (
              <span className="shrink-0 rounded-full bg-score-good-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-score-good ring-1 ring-score-good/25">
                <span className="sr-only">{s.pointsSr}</span>
                {s.points(issue.points)}
              </span>
            ) : null}
          </summary>
          <div className="space-y-4 border-t border-border bg-surface-2/40 px-4 pb-5 pt-4 text-small leading-relaxed text-fg-soft sm:px-5 sm:pl-[4.25rem]">
            {text.whatsWrong && (
              <p lang={textLang}>
                {text.whatsWrong}
                {issue.affectedCount > 0 && <span className="text-muted"> ({s.affects(issue.affectedCount)})</span>}
              </p>
            )}
            {text.howToFix.length > 0 && (
              <ol className="space-y-2" lang={textLang}>
                {text.howToFix.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-fg">
                      {i + 1}
                    </span>
                    <span>
                      <span className="sr-only">{s.stepSr(i + 1)}</span>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted">{s.moreSteps}</p>
          </div>
        </details>
      </Card>
    </li>
  );
}

/** The four scores as small rings: short name (SEO) and plain name (Google Score) under each. No paragraphs. */
function ScoreTiles({ pillars, s }: { pillars: FreeCheckPillar[]; s: FreeCheckStrings }) {
  return (
    <figure className="mt-7 border-t border-border pt-6">
      <figcaption className="sr-only">{s.fourScores}</figcaption>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pillars.map((p) => {
          const name = s.pillarName[p.pillar] ?? p.label;
          const [code, plain] = name.includes(" · ") ? name.split(" · ") : [name, ""];
          const measured = scoreBand(p.score) !== "none";
          return (
            <li key={p.pillar} title={s.pillarQuestion[p.pillar]} className="flex flex-col items-center rounded-xl border border-border bg-surface-2/50 px-2 py-4 text-center">
              <ScoreRing score={p.score} size="md" label={name} />
              <p className="mt-2 text-small font-semibold leading-tight text-fg">{code}</p>
              {plain && <p className="text-xs leading-tight text-muted">{plain}</p>}
              {!measured && <p className="mt-1 text-[11px] text-muted">{s.fullCheckOnly}</p>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** A two-bar graph: your score now, and where the top fixes could take it, with the "Good" line at 75. */
function ScoreJourney({ score, gain, fixes, s }: { score: number | null; gain: number; fixes: number; s: FreeCheckStrings }) {
  const band: ScoreBand = scoreBand(score);
  if (band === "none") return null;
  const now = Math.max(0, Math.min(100, Math.round(score as number)));
  const after = Math.min(100, now + gain);
  const rows = [
    { label: s.nowLabel, value: now, fill: SCORE_BAND_CLASS[band].bg },
    ...(after > now ? [{ label: s.afterLabel, value: after, fill: "bg-score-good" }] : []),
  ];
  return (
    <figure className="mt-6 border-t border-border pt-6">
      <figcaption className="sr-only">{s.meaning}</figcaption>
      <div className="relative space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[5.5rem_1fr_2.25rem] items-center gap-3 sm:grid-cols-[8rem_1fr_2.5rem]">
            <span className="text-xs font-medium leading-tight text-fg-soft">{r.label}</span>
            <span className="relative h-3.5 overflow-hidden rounded-full bg-surface-3">
              <span className={clsx("mk-bar absolute inset-y-0 left-0 rounded-full", r.fill)} style={{ width: `${r.value}%` }} />
              {/* "Good" starts at 75 */}
              <span aria-hidden className="absolute inset-y-0 w-0.5 bg-fg/40" style={{ left: "75%" }} />
            </span>
            <span className="text-right text-small font-semibold tabular-nums text-fg">{r.value}</span>
          </div>
        ))}
        <div aria-hidden className="grid grid-cols-[5.5rem_1fr_2.25rem] gap-3 sm:grid-cols-[8rem_1fr_2.5rem]">
          <span />
          <span className="relative h-4 text-[11px] text-muted">
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: "75%" }}>
              ▲ {s.goodMark} 75
            </span>
          </span>
          <span />
        </div>
      </div>
      {after > now && <p className="mt-2 text-small font-medium text-fg">{s.afterFixes(fixes, after)}</p>}
    </figure>
  );
}

/* ------------------------------------------------------------------ scan summary, locked problems, checks */

const SEVERITY: { key: IssueImpact; bar: string; dot: string }[] = [
  { key: "high", bar: "bg-danger", dot: "bg-danger" },
  { key: "medium", bar: "bg-warning", dot: "bg-warning" },
  { key: "low", bar: "bg-info", dot: "bg-info" },
];

/** "/pricing" for https://site.com/pricing ("/" for the homepage). */
const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return decodeURIComponent(x.pathname) || "/";
  } catch {
    return u;
  }
};

/** Big numbers (pages read · checks run · passed · problems), a coloured severity bar, and the pages we read. */
function ScanSummary({ result, s }: { result: FreeCheckResult; s: FreeCheckStrings }) {
  const checks = result.pillars.reduce((a, p) => a + (p.counts?.total ?? 0), 0);
  const passed = result.pillars.reduce((a, p) => a + (p.counts?.pass ?? 0), 0);
  const counts = result.issueCounts;
  const problems = result.totalIssues;
  const stats = [
    { value: result.pagesChecked.length, label: s.statPages, tone: "text-fg" },
    { value: checks, label: s.statChecks, tone: "text-fg" },
    { value: passed, label: s.statPassed, tone: "text-score-good" },
    { value: problems, label: s.statProblems, tone: problems ? "text-danger" : "text-score-good" },
  ];
  return (
    <section aria-labelledby="fc-scan" className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7">
      <h2 id="fc-scan" className="text-h4 text-fg">
        {s.scanTitle}
      </h2>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="rounded-xl bg-surface-2/60 px-3 py-4 text-center">
            <dt className="sr-only">{x.label}</dt>
            <dd>
              <span className={clsx("block text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.03em]", x.tone)}>{x.value}</span>
              <span className="mt-1.5 block text-xs text-muted">{x.label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {counts && problems > 0 && (
        <div className="mt-5">
          <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-surface-3">
            {SEVERITY.map((v) =>
              counts[v.key] ? <span key={v.key} className={clsx("mk-bar h-full", v.bar)} style={{ width: `${(counts[v.key] / problems) * 100}%` }} /> : null,
            )}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-soft">
            {SEVERITY.map((v) => (
              <li key={v.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={clsx("size-2.5 rounded-full", v.dot)} />
                <span className="font-semibold tabular-nums text-fg">{counts[v.key]}</span> {s.impact[v.key]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.pagesChecked.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted">{s.pagesReadTitle}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" lang="en">
            {result.pagesChecked.map((u) => (
              <li key={u} className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-fg-soft">
                <Check aria-hidden size={12} className="shrink-0 text-score-good" />
                <span className="truncate">{pathOf(u)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{s.fullReadsAll}</p>
        </div>
      )}
    </section>
  );
}

/** More problems by title only, each locked ("Fix in full report"), then one unlock button. */
function LockedProblems({
  items,
  total,
  ctaHref,
  lang,
  s,
}: {
  items: FreeCheckLockedIssue[];
  total: number;
  ctaHref: string;
  lang: FreeCheckLang;
  s: FreeCheckStrings;
}) {
  const rest = Math.max(0, total - items.length);
  return (
    <section aria-labelledby="fc-more-problems">
      <SectionHeading id="fc-more-problems" title={s.moreTitle(total)} description={s.moreIntro} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        {items.map((i) => {
          const t = lang === "hi" ? hindiFix({ ...i, whatsWrong: "", howToFix: [] }) : { title: i.title, translated: true };
          const level = IMPACT_LEVEL[i.impact] ?? 1;
          return (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <span aria-hidden className={clsx("size-2.5 shrink-0 rounded-full", SEVERITY[3 - level]?.dot ?? "bg-info")} />
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium leading-snug text-fg" lang={lang === "hi" && !t.translated ? "en" : undefined}>
                  {t.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {s.impact[i.impact] ?? s.impact.low}
                  {i.points ? <> · {s.points(i.points)}</> : null}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                <Lock aria-hidden size={11} />
                <span className="max-sm:sr-only">{s.lockedFix}</span>
              </span>
            </li>
          );
        })}
        {rest > 0 && <li className="px-4 py-3 text-center text-xs font-medium text-muted sm:px-5">{s.andMore(rest)}</li>}
      </ul>
      <div className="mt-4 flex justify-center">
        <LinkButton href={ctaHref} iconRight={<ArrowRight />} icon={<Lock />}>
          {s.unlockFixes}
        </LinkButton>
      </div>
    </section>
  );
}

const CHECK_ICON = {
  pass: { Icon: Check, cls: "bg-score-good-soft text-score-good" },
  warn: { Icon: CircleAlert, cls: "bg-warning-soft text-warning" },
  fail: { Icon: XIcon, cls: "bg-danger-soft text-danger" },
} as const;

/** Each area as a progress bar ("20 of 21 passed") that opens to its checks (✓ / ! / ✗), plus what already works. */
function CheckedAreas({ pillars, strengths, s }: { pillars: FreeCheckPillar[]; strengths: string[]; s: FreeCheckStrings }) {
  return (
    <section aria-labelledby="fc-checked">
      <SectionHeading id="fc-checked" title={s.checkedTitle} description={s.checkedIntro} />
      <ul className="space-y-3">
        {pillars
          .filter((p) => p.checks.length > 0)
          .map((p) => {
            const name = s.pillarName[p.pillar] ?? p.label;
            const c = p.counts ?? { pass: 0, total: p.checks.length, fail: 0 };
            const pct = c.total ? Math.round((c.pass / c.total) * 100) : 0;
            const band = scoreBand(p.score);
            const more = Math.max(0, c.total - p.checks.length);
            return (
              <li key={p.pillar}>
                <details className="group rounded-2xl border border-border bg-surface shadow-card">
                  <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-small font-semibold text-fg">{name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{s.passedOf(c.pass, c.total)}</span>
                      </span>
                      <span aria-hidden className="mt-2 block h-2.5 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={clsx("mk-bar block h-full rounded-full", band === "none" ? "bg-score-good" : SCORE_BAND_CLASS[band].bg)}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <ChevronDown aria-hidden size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="space-y-2 border-t border-border px-4 pb-4 pt-3 sm:px-5" lang="en">
                    {p.checks.map((ch) => {
                      const st = CHECK_ICON[ch.status as keyof typeof CHECK_ICON] ?? CHECK_ICON.warn;
                      return (
                        <li key={ch.id} className="flex items-center gap-2.5 text-small text-fg-soft">
                          <span className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full", st.cls)}>
                            <st.Icon aria-label={ch.status} size={12} strokeWidth={3} />
                          </span>
                          {ch.label}
                        </li>
                      );
                    })}
                    {more > 0 && <li className="pl-7 text-xs text-muted">{s.moreChecks(more)}</li>}
                  </ul>
                </details>
              </li>
            );
          })}
      </ul>

      {strengths.length > 0 && (
        <div className="mt-6">
          <h3 className="text-small font-semibold text-fg">{s.workingTitle}</h3>
          <ul className="mt-3 flex flex-wrap gap-2" lang="en">
            {strengths.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-score-good-soft px-3 py-1.5 text-xs font-medium text-score-good">
                <Check aria-hidden size={13} strokeWidth={3} className="shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ at a glance, benchmark, ChatGPT, plan, sticky */

/** Google shows about 60 characters of a headline and about 160 of a summary. */
const GOOGLE_TITLE_MAX = 60;
const GOOGLE_DESC_MAX = 160;
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** "Better than 34% of websites checked": a 0–100 line with the average and this site marked. */
function BenchmarkBar({ b, score, s }: { b: FreeCheckBenchmark; score: number; s: FreeCheckStrings }) {
  const you = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <figure className="mt-6 border-t border-border pt-6">
      <figcaption className="text-small font-semibold text-fg">{s.benchBetter(b.betterThan)}</figcaption>
      <div aria-hidden className="relative mt-8 h-2.5 rounded-full bg-gradient-to-r from-score-poor/40 via-score-ok/40 to-score-good/40">
        <span className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-fg/40" style={{ left: `${b.average}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted" style={{ left: `${Math.max(8, Math.min(92, b.average))}%` }}>
          {s.benchAverage(b.average)}
        </span>
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg bg-primary shadow" style={{ left: `${you}%` }} />
        <span
          className="absolute top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-fg"
          style={{ left: `${Math.max(8, Math.min(92, you))}%` }}
        >
          {s.benchYou}: {you}
        </span>
      </div>
      <div className="h-6" />
    </figure>
  );
}

/** Google preview of the homepage, AI assistants that can read it, and the basics as ✓ / ✗ tiles. */
function AtAGlance({ snap, host, s }: { snap: FreeCheckSnapshot; host: string; s: FreeCheckStrings }) {
  const g = snap.google;
  const notes: { ok: boolean; text: string }[] = [];
  if (!g.title) notes.push({ ok: false, text: s.googleNoTitle });
  else if (g.title.length > GOOGLE_TITLE_MAX) notes.push({ ok: false, text: s.googleTitleLong });
  if (!g.description) notes.push({ ok: false, text: s.googleNoDesc });
  else if (g.description.length > GOOGLE_DESC_MAX) notes.push({ ok: false, text: s.googleDescLong });
  if (!notes.length) notes.push({ ok: true, text: s.googleOk });

  const f = snap.facts;
  const basics = [
    { ok: f.https, text: s.factHttps },
    { ok: f.sitemap, text: s.factSitemap(f.sitemapUrls) },
    { ok: f.robotsTxt, text: s.factRobots },
    { ok: f.schemaTypes.length > 0, text: s.factSchema },
    { ok: f.h1, text: s.factH1 },
    { ok: f.llmsTxt, text: s.factLlms },
    ...(f.images > 0 ? [{ ok: f.imagesWithoutAlt === 0, text: s.factAlt(f.images - f.imagesWithoutAlt, f.images) }] : []),
  ];

  return (
    <section aria-labelledby="fc-glance" className="space-y-4">
      <h2 id="fc-glance" className="text-h3 text-fg">
        {s.glanceTitle}
      </h2>

      {/* Google result preview */}
      <figure className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <figcaption className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{s.googleTitle}</figcaption>
        <div className="mt-4 rounded-xl border border-border bg-bg p-4" lang="en">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold uppercase text-fg-soft">
              {host.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-small text-fg">{host}</span>
              <span className="block truncate text-xs text-muted">{g.url}</span>
            </span>
          </div>
          <p className={clsx("mt-2 text-[1.125rem] leading-snug", g.title ? "text-[#1a0dab]" : "italic text-muted")}>
            {g.title ? cut(g.title, GOOGLE_TITLE_MAX) : s.googleNoTitle}
          </p>
          <p className="mt-1 text-small leading-relaxed text-[#4d5156]">
            {g.description ? cut(g.description, GOOGLE_DESC_MAX) : <span className="italic text-muted">…</span>}
          </p>
        </div>
        <ul className="mt-3 space-y-1.5">
          {notes.map((n) => (
            <li key={n.text} className={clsx("flex items-start gap-2 text-small", n.ok ? "text-score-good" : "text-danger")}>
              {n.ok ? <Check aria-hidden size={16} className="mt-0.5 shrink-0" /> : <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />}
              {n.text}
            </li>
          ))}
        </ul>
      </figure>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* AI assistants */}
        <figure className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <figcaption className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{s.aiTitle}</figcaption>
          <ul className="mt-4 grid grid-cols-2 gap-2.5">
            {snap.ai.map((a) => (
              <li
                key={a.name}
                className={clsx(
                  "flex flex-col items-center rounded-xl border px-2 py-3 text-center",
                  a.allowed ? "border-score-good/30 bg-score-good-soft" : "border-danger/30 bg-danger-soft",
                )}
              >
                <span className={clsx("flex size-8 items-center justify-center rounded-full text-white", a.allowed ? "bg-score-good" : "bg-danger")}>
                  {a.allowed ? <Check aria-hidden size={17} strokeWidth={3} /> : <XIcon aria-hidden size={17} strokeWidth={3} />}
                </span>
                <span className="mt-1.5 text-small font-semibold text-fg" lang="en">
                  {a.name}
                </span>
                <span className={clsx("text-xs font-medium", a.allowed ? "text-score-good" : "text-danger")}>{a.allowed ? s.aiAllowed : s.aiBlocked}</span>
              </li>
            ))}
          </ul>
        </figure>

        {/* Basics */}
        <figure className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <figcaption className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{s.basicsTitle}</figcaption>
          <ul className="mt-4 space-y-2.5">
            {basics.map((b) => (
              <li key={b.text} className="flex items-center gap-2.5 text-small text-fg">
                <span className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full", b.ok ? "bg-score-good-soft text-score-good" : "bg-danger-soft text-danger")}>
                  {b.ok ? <Check aria-label="yes" size={12} strokeWidth={3} /> : <XIcon aria-label="no" size={12} strokeWidth={3} />}
                </span>
                {b.text}
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}

/** A locked, blurred ChatGPT conversation about the business: the free check never asks AI; the full check does. */
function ChatPreview({ name, ctaHref, s }: { name: string; ctaHref: string; s: FreeCheckStrings }) {
  return (
    <section aria-labelledby="fc-chat" className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 id="fc-chat" className="text-h4 text-fg">
          {s.chatTitle}
        </h2>
      </div>
      <div className="space-y-3 bg-surface-2/50 px-5 py-5 sm:px-6">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-small text-primary-fg">{s.chatAsk(name)}</div>
        {/* Placeholder lines only (never a made-up answer), blurred under the lock. */}
        <div className="relative">
          <div aria-hidden className="max-w-[90%] select-none space-y-2.5 rounded-2xl rounded-bl-md bg-surface p-4 blur-[5px]">
            <div className="h-3 w-11/12 rounded bg-fg/20" />
            <div className="h-3 w-full rounded bg-fg/20" />
            <div className="h-3 w-9/12 rounded bg-fg/20" />
            <div className="h-3 w-10/12 rounded bg-fg/20" />
            <div className="h-3 w-full rounded bg-fg/20" />
            <div className="h-3 w-8/12 rounded bg-fg/20" />
            <div className="h-3 w-10/12 rounded bg-fg/20" />
            <div className="h-3 w-6/12 rounded bg-fg/20" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-2 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-fg text-bg shadow-lg">
              <Lock aria-hidden size={20} />
            </span>
            <p className="max-w-xs text-small font-medium text-fg">{s.chatLocked}</p>
            <LinkButton href={ctaHref} size="sm" iconRight={<ArrowRight />}>
              {s.chatCta}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Week-by-week plan built from this site's own problem counts: urgent first. Locked behind the trial. */
function PlanTimeline({ counts, ctaHref, s }: { counts: Record<IssueImpact, number>; ctaHref: string; s: FreeCheckStrings }) {
  const weeks = [
    { label: s.planWeeks[0], key: "high" as const, dot: "bg-danger" },
    { label: s.planWeeks[1], key: "medium" as const, dot: "bg-warning" },
    { label: s.planWeeks[2], key: "low" as const, dot: "bg-info" },
  ].filter((w) => counts[w.key] > 0);
  if (!weeks.length) return null;
  return (
    <section aria-labelledby="fc-plan" className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-7">
      <h2 id="fc-plan" className="text-h4 text-fg">
        {s.planTitle}
      </h2>
      <p className="mt-1 text-small text-muted">{s.planIntro}</p>
      <ol className="relative mt-6 space-y-5 border-l-2 border-dashed border-border-strong pl-6">
        {weeks.map((w) => (
          <li key={w.key} className="relative">
            <span aria-hidden className={clsx("absolute -left-[33px] top-1 size-4 rounded-full border-[3px] border-bg", w.dot)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-small font-semibold text-fg">
                {w.label} · {s.planFixes(counts[w.key])}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                <Lock aria-hidden size={11} />
                {s.impact[w.key]}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <LinkButton href={ctaHref} iconRight={<ArrowRight />}>
          {s.planCta}
        </LinkButton>
      </div>
    </section>
  );
}

/** Phones: a slim bar at the bottom ("19 problems found · Fix them free") once the visitor scrolls past the score. */
function StickyCta({ problems, href, label, s }: { problems: number; href: string; label: string; s: FreeCheckStrings }) {
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (closed || !show || problems === 0) return null;
  return (
    <div className="animate-fade-in fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-[84px] z-30 flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 shadow-xl sm:hidden">
      <span className="min-w-0 flex-1 truncate text-small font-semibold text-fg">{s.stickyText(problems)}</span>
      <a href={href} aria-label={label} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-small font-semibold text-primary-fg">
        {s.stickyCta}
        <ArrowRight aria-hidden size={15} />
      </a>
      <button type="button" onClick={() => setClosed(true)} aria-label={s.stickyClose} className="sr-only focus:not-sr-only">
        {s.stickyClose}
      </button>
    </div>
  );
}

<<<<<<< HEAD
/**
 * Fixes 2+ blurred, with the WhatsApp box on top ("Your full report is ready"). Once a number is saved they are
 * shown in full here, and the report link goes out on WhatsApp.
 */
function LockedFixes({
  issues,
  leadId,
  website,
  lang,
  s,
}: {
  issues: FreeCheckIssue[];
  leadId: string | null;
  website: string;
  lang: FreeCheckLang;
  s: FreeCheckStrings;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const box = <WhatsAppBox leadId={leadId} website={website} lang={lang} s={s} onSaved={() => setUnlocked(true)} />;
  if (issues.length === 0) return <div className="mt-6 flex justify-center">{box}</div>;
  if (unlocked) {
    return (
      <>
        <ol start={2} className="mt-6 space-y-6">
          {issues.map((i, n) => (
            <FixCard key={i.id} issue={i} n={n + 2} lang={lang} s={s} />
          ))}
        </ol>
        <div className="mt-6 flex justify-center">{box}</div>
      </>
    );
  }
=======
/** The email box. When some fixes are not shown it sits on top of blurred placeholders for them. */
function HiddenFixes({ count, leadId, login, s }: { count: number; leadId: string | null; login: string | null; s: FreeCheckStrings }) {
  const box = leadId ? (
    <EmailBox leadId={leadId} login={login} s={s} />
  ) : (
    <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-small font-medium text-fg shadow-lg">
      <Lock aria-hidden size={16} className="text-primary" />
      {s.lockedInFull}
    </p>
  );
  if (count === 0) return <section aria-label={s.emailLabel} className="flex justify-center">{box}</section>;
  const placeholders = Math.min(count, 3);
>>>>>>> eb3b71c1c7f6e3be7f98e3d19e6a6b9c216ea0d2
  return (
    <div className="relative mt-6">
      <ol aria-hidden className="pointer-events-none min-h-[22rem] select-none space-y-6 blur-[6px]" inert>
        {issues.map((i, n) => (
          <FixCard key={i.id} issue={i} n={n + 2} lang={lang} s={s} />
        ))}
      </ol>
      <div className="absolute inset-0 flex items-start justify-center p-2 pt-6 sm:p-4 sm:pt-10">{box}</div>
    </div>
  );
}

<<<<<<< HEAD
/** "98765 43210" from "919876543210". */
const shownNumber = (n: string) => `${n.slice(-10, -5)} ${n.slice(-5)}`;

/**
 * One field: WhatsApp number (+91 shown, 10-digit check). With a lead id it unlocks the report; without one (the
 * check failed) it asks our team to run the check by hand. Meta Lead fires once, with the server's event id.
 */
export function WhatsAppBox({
  leadId = null,
  website,
  failure,
  lang,
  s,
  onSaved,
  bare = false,
}: {
  leadId?: string | null;
  website: string;
  /** Why the check failed (unreachable, timeout…): the box is the fallback for a check that didn't finish. */
  failure?: string;
  lang: FreeCheckLang;
  s: FreeCheckStrings;
  onSaved?: () => void;
  /** No card frame and heading (inside another card). */
  bare?: boolean;
}) {
  const [phone, setPhone] = useState("");
=======
/**
 * Log in first (the main way to see the full report), with the email form as the fallback for people who
 * don't want to log in. Signed-in visitors (login = null) only get the email form; they have "Add to my account".
 */
function EmailBox({ leadId, login, s }: { leadId: string; login: string | null; s: FreeCheckStrings }) {
  const [email, setEmail] = useState("");
>>>>>>> eb3b71c1c7f6e3be7f98e3d19e6a6b9c216ea0d2
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const frame = bare ? "w-full" : "w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl";

  if (saved) {
    return (
      <div className={clsx(frame, "text-center")} role="status">
        <MessageCircle aria-hidden className="mx-auto text-[#128C7E]" size={24} />
        <p className="mt-2 text-small font-semibold text-fg">{failure ? s.waThanksFailed(shownNumber(saved)) : s.waThanks(shownNumber(saved))}</p>
        <p className="mt-1 text-xs text-muted">{s.waThanksNext}</p>
        <LinkButton href={signupHref(website)} size="md" className="mt-3" iconRight={<ArrowRight />} onClick={() => track("trial_click", { from: "whatsapp_box" })}>
          {s.startTrial}
        </LinkButton>
      </div>
    );
  }

  const fieldId = failure ? "fc-wa-fail" : "fc-wa";
  return (
    <form
      className={frame}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const digits = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
        if (!/^[6-9]\d{9}$/.test(digits)) {
          setError(s.waInvalid);
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/public/free-check/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...(leadId ? { leadId } : { url: website }), failure, phone: digits, attribution: readAttribution() }),
          });
          const data = (await res.json().catch(() => null)) as { eventId?: string; firstTime?: boolean; error?: { code?: string; message?: string } } | null;
          if (res.ok) {
            setSaved(`91${digits}`);
            onSaved?.();
            // Exactly once per number saved: the same event id as the server's Conversions API "Lead".
            if (data?.firstTime && data.eventId) {
              track("whatsapp_lead", { website: resultHost(website), failed: Boolean(failure), lang }, { name: "Lead", eventId: data.eventId });
            }
          } else {
            const code = data?.error?.code;
            setError(code === "invalid_phone" || code === "validation_error" ? s.waInvalid : (lang === "en" ? data?.error?.message : null) ?? s.waFailed);
          }
        } catch {
          setError(s.waNetwork);
        } finally {
          setBusy(false);
        }
      }}
    >
<<<<<<< HEAD
      {!bare && (
        <>
          <h3 className="text-h4 text-fg">{s.waTitle}</h3>
          <p className="mb-4 mt-1 text-small text-fg-soft">{s.waIntro}</p>
        </>
      )}
      <Field label={s.waLabel} htmlFor={fieldId} error={error}>
        <div className="flex items-stretch gap-2">
          <span aria-hidden className="inline-flex shrink-0 items-center rounded-lg border border-border bg-surface-2 px-3 text-base font-medium text-fg">
            +91
          </span>
          <Input
            id={fieldId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            lang="en"
            placeholder={s.waPlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, "").slice(0, 16))}
            maxLength={16}
            invalid={!!error}
            disabled={busy}
            aria-describedby={fieldDescribedBy(fieldId, { error })}
            className="min-w-0 flex-1"
          />
        </div>
=======
      {login && (
        <div className="mb-5 text-center">
          <p className="text-h4 text-fg">{s.loginTitle}</p>
          <p className="mt-1 text-xs text-muted">{s.loginBody}</p>
          <LinkButton href={login} size="lg" className="mt-4 w-full" iconRight={<ArrowRight />}>
            {s.loginButton}
          </LinkButton>
          <div className="mt-5 flex items-center gap-3 text-xs text-muted">
            <span aria-hidden className="h-px flex-1 bg-border" />
            {s.orEmail}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}
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
>>>>>>> eb3b71c1c7f6e3be7f98e3d19e6a6b9c216ea0d2
      </Field>
      <Button type="submit" className="mt-3 w-full" loading={busy} loadingText={s.waSaving} icon={<MessageCircle />}>
        {s.waButton}
      </Button>
      <p className="mt-2 text-xs text-muted">{s.waNote}</p>
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
