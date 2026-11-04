import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Globe, Lightbulb, Users, X } from "lucide-react";
import { db } from "@/lib/db";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { asArray, asRecord, fmtDate } from "@/lib/dashboard/format";
import { getUserTimeZone } from "@/lib/dashboard/tz";
import {
  groupByQuestion,
  joinNames,
  rivalsForQuestion,
  sourcesForQuestion,
  stepsToGetNamed,
  type AnswerObservation,
} from "@/lib/dashboard/ai-answers";
import { OPEN_STATUSES } from "@/lib/tasks/types";
import { questionHref } from "@/components/app/nav";
import { engineName } from "@/components/app/providers-status";
import { AnswerText } from "@/components/app/ai-answers/answer-text";
import { AddToTasksButton } from "@/components/app/fix/add-to-tasks";
import { Badge, Card } from "@/components/ui";

export const metadata = { title: "Customer question" };

const DONE = ["succeeded", "succeeded_with_warnings"];
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

type Obs = Awaited<ReturnType<typeof loadObservations>>[number];

function loadObservations(organizationId: string, where: { visibilityRunId?: string | { in: string[] }; promptId?: string }) {
  return db.observation.findMany({
    where: { organizationId, ...where },
    include: { prompt: { select: { id: true, text: true } } },
    orderBy: { createdAt: "asc" },
  });
}

const toAnswer = (o: Obs): AnswerObservation => ({
  id: o.id,
  promptId: o.prompt.id,
  prompt: o.prompt.text,
  provider: o.provider,
  platformLabel: o.platformLabel,
  brandMentioned: o.brandMentioned,
  brandCited: o.brandCited,
  brandRecommended: o.brandRecommended,
  competitorMentions: asRecord<number>(o.competitorMentions),
  rawResponse: o.rawResponse,
  citations: asArray<AnswerObservation["citations"][number]>(o.citations),
  simulated: o.simulated,
});

// One customer question in detail: did each AI tool name the business, who it named instead, which websites it
// read, how this changed over time, and specific steps to get named — with "Add to my To-do" as the one next step.
export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; promptId: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const [{ id, promptId: raw }, sp] = await Promise.all([params, searchParams]);
  const promptId = decodeURIComponent(raw);
  const { session, project } = await requireAppProject(id);
  const org = session.organizationId;

  const [prompt, runs, timeZone] = await Promise.all([
    db.trackedPrompt.findFirst({ where: { id: promptId, organizationId: org, projectId: project.id }, select: { id: true, text: true, active: true } }),
    db.visibilityRun.findMany({
      where: { organizationId: org, projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, createdAt: true, finishedAt: true },
    }),
    getUserTimeZone(session),
  ]);
  if (!prompt) notFound();

  const run = runs.find((r) => r.id === sp.run) ?? runs.find((r) => DONE.includes(r.status)) ?? null;
  const ownNames = strings(project.brandNames);
  const brand = ownNames[0] ?? project.name;

  // This check's answers for every question (for previous / next), and this question across recent checks.
  const recentRuns = runs.filter((r) => DONE.includes(r.status)).slice(0, 6);
  const [runObs, historyObs] = await Promise.all([
    run ? loadObservations(org, { visibilityRunId: run.id }) : Promise.resolve([]),
    recentRuns.length ? loadObservations(org, { promptId: prompt.id, visibilityRunId: { in: recentRuns.map((r) => r.id) } }) : Promise.resolve([]),
  ]);
  const questions = groupByQuestion(runObs.map(toAnswer), ownNames);
  const at = questions.findIndex((q) => q.promptId === prompt.id);
  const q = at >= 0 ? questions[at] : null;
  const prev = at > 0 ? questions[at - 1] : null;
  const next = at >= 0 && at < questions.length - 1 ? questions[at + 1] : null;

  const answers = q?.answers ?? [];
  const rivals = rivalsForQuestion(answers, ownNames);
  const sources = sourcesForQuestion(answers);
  const outside = sources.filter((s) => !s.owned);
  const steps = stepsToGetNamed({ question: prompt.text, brand, named: !!q?.named, rivals, sources });

  const history = recentRuns
    .map((r) => {
      const xs = historyObs.filter((o) => o.visibilityRunId === r.id && !o.simulated);
      return { id: r.id, at: r.finishedAt ?? r.createdAt, named: xs.filter((o) => o.brandMentioned).length, total: xs.length };
    })
    .filter((h) => h.total > 0)
    .reverse();

  const taskTitle = `Get named by AI for: ${prompt.text}`.slice(0, 200);
  const existing = await db.task.findFirst({
    where: { organizationId: org, projectId: project.id, title: taskTitle, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  });
  const taskText = [
    `Customer question: "${prompt.text}"`,
    q ? `AI named ${brand} in ${q.namedCount} of ${answers.length} answers.` : "",
    rivals.length ? `Named instead: ${rivals.slice(0, 5).map((r) => r.name).join(", ")}.` : "",
    "",
    "What to do:",
    ...steps.map((s, i) => `${i + 1}. ${s.title} — ${s.detail}`),
  ]
    .join("\n")
    .slice(0, 4900);

  const listHref = `/app/projects/${project.id}/visibility${run && sp.run ? `?run=${run.id}` : ""}`;

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-small font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> All questions
      </Link>

      <header className="space-y-3">
        <p className="eyebrow">
          Customer question{at >= 0 ? ` ${at + 1} of ${questions.length}` : ""}
          {!prompt.active && " · Paused"}
        </p>
        <h1 className="text-h1 text-balance text-fg">&ldquo;{prompt.text}&rdquo;</h1>
        {q ? (
          <div
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-small font-semibold",
              q.named ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
            )}
          >
            {q.named ? <Check size={16} strokeWidth={3} aria-hidden /> : <X size={16} strokeWidth={3} aria-hidden />}
            AI named you in {q.namedCount} of {answers.length} {answers.length === 1 ? "answer" : "answers"}
          </div>
        ) : (
          <p className="text-body text-muted">We haven&apos;t asked AI this question yet. It will be in your next AI check.</p>
        )}
        {run && q && <p className="text-small text-muted">From the AI check on {fmtDate(run.finishedAt ?? run.createdAt, { timeZone })}.</p>}
      </header>

      {q && (
        <Card as="section" padding="md" aria-label="What this means" className="space-y-2">
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">What this means</h2>
          <p className="text-body text-fg">
            {q.named
              ? `When a customer asks this, ${q.namedCount === answers.length ? "every AI tool we asked" : `${q.namedCount} of ${answers.length} AI tools`} mention ${brand}.`
              : `When a customer asks this, none of the AI tools we asked mention ${brand}.`}
            {rivals.length > 0 && ` They point people to ${joinNames(rivals.slice(0, 3).map((r) => r.name))} instead.`}
          </p>
          <p className="text-small text-fg-soft">
            More and more people ask ChatGPT, Gemini and other AI tools instead of searching Google. If AI doesn&apos;t name you, those customers
            never hear about you.
          </p>
        </Card>
      )}

      {rivals.length > 0 && (
        <Card as="section" aria-labelledby="rivals">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 id="rivals" className="flex items-center gap-2 text-h4 text-fg">
              <Users size={18} aria-hidden className="text-muted" /> Who AI recommends {q?.named ? "alongside you" : "instead"}
            </h2>
            <p className="mt-0.5 text-small text-muted">Businesses and websites the AI tools named for this question.</p>
          </div>
          <ul className="divide-y divide-border">
            {rivals.slice(0, 8).map((r) => (
              <li key={r.name} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="font-medium text-fg">{r.name}</span>
                <span className="text-small text-muted">
                  Named by {r.engines} of {answers.length} · {joinNames(r.providers.map(engineName))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {outside.length > 0 && (
        <Card as="section" padding="md" aria-labelledby="sources">
          <h2 id="sources" className="flex items-center gap-2 text-h4 text-fg">
            <Globe size={18} aria-hidden className="text-muted" /> Where AI got its information
          </h2>
          <p className="mt-0.5 text-small text-muted">The websites the AI tools read to answer this question. Being on these sites helps AI name you.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {outside.slice(0, 12).map((s) => (
              <li key={s.domain}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-small font-medium text-fg-soft hover:border-border-strong"
                >
                  {s.domain}
                  <span className="text-xs text-muted">×{s.count}</span>
                  <ExternalLink size={12} aria-hidden className="text-muted" />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {answers.length > 0 && (
        <section aria-labelledby="by-tool" className="space-y-3">
          <h2 id="by-tool" className="text-h4 text-fg">What each AI tool said</h2>
          {answers.map((a, i) => {
            const own = a.citations.filter((c) => c.ownedByCustomer);
            return (
              <details key={a.id} open={i === 0} className="group rounded-2xl border border-border bg-surface shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-fg">{engineName(a.platformLabel || a.provider)}</span>
                  {a.brandMentioned ? <Badge tone="success" size="sm">Named you</Badge> : <Badge tone="neutral" size="sm">Didn&apos;t name you</Badge>}
                  {a.brandRecommended && <Badge tone="success" size="sm">Recommended you</Badge>}
                  {a.simulated && <Badge tone="warning" size="sm">Sample</Badge>}
                  <span className="ml-auto text-xs font-medium text-primary group-open:hidden">Read answer</span>
                  <span className="ml-auto hidden text-xs font-medium text-primary group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-border px-5 py-4 sm:px-6">
                  {a.rawResponse ? (
                    <AnswerText text={a.rawResponse} brandNames={ownNames} />
                  ) : (
                    <p className="text-small text-muted">(empty answer)</p>
                  )}
                  {own.length > 0 && (
                    <p className="text-xs text-success">
                      Linked to your website: {own.map((c) => c.title || c.url).slice(0, 3).join(", ")}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      )}

      {history.length > 1 && (
        <Card as="section" padding="md" aria-labelledby="over-time">
          <h2 id="over-time" className="text-h4 text-fg">Over time</h2>
          <p className="mt-0.5 text-small text-muted">How often AI named you for this question in each check.</p>
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-small">
                <span className="w-28 shrink-0 text-muted">{fmtDate(h.at, { timeZone })}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((h.named / h.total) * 100)}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-fg-soft">
                  {h.named} of {h.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card as="section" padding="md" aria-labelledby="get-named">
        <h2 id="get-named" className="flex items-center gap-2 text-h4 text-fg">
          <Lightbulb size={18} aria-hidden className="text-primary" /> How to get named for this question
        </h2>
        <ol className="mt-4 space-y-4">
          {steps.map((s, n) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-small font-semibold text-primary-fg">
                {n + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="font-medium text-fg">{s.title}</p>
                <p className="mt-0.5 text-small text-fg-soft">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div>
          <p className="font-semibold text-fg">Want AI to name you here?</p>
          <p className="text-small text-fg-soft">Add these steps to your To-do. We&apos;ll check this question again in your next AI check.</p>
        </div>
        <AddToTasksButton
          projectId={project.id}
          canEdit={hasRole(session, "member")}
          existing={!!existing}
          task={{ title: taskTitle, description: taskText, category: "offsite", priority: q?.named ? "low" : "high", links: outside.slice(0, 10).map((s) => s.url) }}
        />
      </div>

      <nav aria-label="Other questions" className="flex items-center justify-between gap-3 border-t border-border pt-6 text-small font-medium">
        {prev ? (
          <Link href={questionHref(project.id, prev.promptId, sp.run)} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            <ArrowLeft size={16} aria-hidden /> Previous question
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={questionHref(project.id, next.promptId, sp.run)} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            Next question <ArrowRight size={16} aria-hidden />
          </Link>
        ) : (
          <Link href={listHref} className="text-muted hover:text-fg">
            Back to all questions
          </Link>
        )}
      </nav>
    </div>
  );
}
