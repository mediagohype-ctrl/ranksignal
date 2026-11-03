// Result of the free AI-readiness check: overall ring, compact pillar cards, top issues, strengths, CTA.
import { ArrowRight, Bot, CheckCircle2, Search, Sparkles, Fingerprint, Lock } from "lucide-react";
import { Card, IssueCard, LinkButton, Notice, PillarCard, ScoreRing, SectionHeading } from "@/components/ui";
import type { FreeCheckResult } from "@/lib/free-check/types";
import { TRIAL_DAYS } from "./plans";

const PILLAR_ICON = { seo: <Search />, aeo: <Sparkles />, geo: <Bot />, brand: <Fingerprint /> } as const;

/** Plain names for the four scores (docs/PLAIN_WORDS.md). */
const PILLAR_NAME = { seo: "Google health", aeo: "Easy to quote", geo: "Ready for AI", brand: "AI knows you" } as const;

export function signupHref(url: string) {
  return `/signup?website=${encodeURIComponent(url)}`;
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

  return (
    <div className="animate-fade-in space-y-12" aria-live="polite">
      <Card variant="elevated" padding="lg">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <ScoreRing score={result.overall.score} grade={result.overall.grade} size="lg" label="Your overall score" caption="Overall" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Free website check · {host}</p>
            <h2 className="mt-2 text-balance text-h2 text-fg">{result.overall.headline}</h2>
            <p className="mt-3 text-small text-muted">
              Based on {result.pagesChecked.length} page{result.pagesChecked.length === 1 ? "" : "s"} we read just now
              {result.brand ? <> for <strong className="font-semibold text-fg">{result.brand}</strong></> : null}.
            </p>
          </div>
        </div>
      </Card>

      <section aria-labelledby="fc-pillars">
        <SectionHeading id="fc-pillars" title="Your four scores" description="Each score is out of 100. Some scores need us to ask AI assistants about you, which only the full check does." />
        <div className="grid gap-6 md:grid-cols-2">
          {result.pillars.map((p) => (
            <PillarCard key={p.pillar} {...p} label={PILLAR_NAME[p.pillar] ?? p.label} icon={PILLAR_ICON[p.pillar]} maxChecks={3} />
          ))}
        </div>
      </section>

      <section aria-labelledby="fc-issues">
        <SectionHeading
          id="fc-issues"
          title={result.issues.length ? "Top things to fix" : "No major problems found"}
          description={
            result.issues.length
              ? `${result.issues.length === 1 ? "The most important problem, with the first steps to fix it." : `The ${result.issues.length} most important problems, with the first steps to fix each one.`}${hidden ? ` The full report shows ${hidden} more.` : ""}`
              : "Nice work — the pages we read cover the basics. The full check reads many more pages and asks AI assistants about you."
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
              pillarLabel={PILLAR_NAME[i.pillar] ?? i.pillarLabel}
              collapsible
              defaultOpen={n < 2}
            />
          ))}
        </div>
      </section>

      {result.strengths.length > 0 && (
        <section aria-labelledby="fc-strengths">
          <SectionHeading id="fc-strengths" title="What you're already doing well" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {result.strengths.map((s) => (
              <li key={s} className="flex gap-3 rounded-xl bg-surface-2 px-4 py-3 text-small text-fg-soft">
                <CheckCircle2 aria-hidden size={18} className="mt-0.5 shrink-0 text-success" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Notice tone="info" title="What this free check doesn't cover" icon={<Lock />}>
        <ul className="list-disc space-y-1 pl-5">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Notice>

      <div className="bg-hero relative overflow-hidden rounded-2xl px-6 py-12 text-center shadow-lg sm:px-12">
        <h2 className="mx-auto max-w-2xl text-balance text-h2 text-navy-fg">Find out what ChatGPT and Gemini say about {result.brand ?? host}</h2>
        <p className="mx-auto mt-3 max-w-xl text-lead text-navy-fg/80">
          This free check only read your website. The full check reads your whole site, asks ChatGPT, Gemini and
          others the questions your customers ask, and gives you a step-by-step to-do list.
        </p>
        <div className="mt-8 flex justify-center">
          <LinkButton href={signupHref(result.url)} size="lg" variant="accent" iconRight={<ArrowRight />}>
            Try the full check free for {TRIAL_DAYS} days
          </LinkButton>
        </div>
        <p className="mt-4 text-small text-navy-fg/70">Nobody can promise a Google position or an AI mention. We measure honestly.</p>
      </div>
    </div>
  );
}
