import Link from "next/link";
import clsx from "clsx";
import { FileText, Link2, ListChecks, MessageSquare, ThumbsUp } from "lucide-react";
import { getExpertMode } from "@/lib/expert";
import { groupByQuestion, joinNames, runProviders, wrongFacts, type AnswerObservation } from "@/lib/dashboard/ai-answers";
import { AnswersList } from "@/components/app/ai-answers/answers-list";
import { WrongFacts } from "@/components/app/ai-answers/wrong-facts";
import { db } from "@/lib/db";
import { readMetrics } from "@/lib/dashboard/data";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asArray, asRecord, fmtDate, isActiveStatus, pct } from "@/lib/dashboard/format";
import { describeProviders } from "@/lib/providers/visibility/registry";
import { getOrgEngineLimit } from "@/lib/billing/ai-limits";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { ProvidersStatus, engineName, type PublicProvider } from "@/components/app/providers-status";
import { RunButtons } from "@/components/app/run-buttons";
import { VisibilityTable, type ObservationRow } from "@/components/app/visibility-table";
import {
  Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Meter, PageHeader, SimulatedDataBanner, Stat, StatusBadge, Table, TD, TH,
  THead, TR,
} from "@/components/ui";

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const metadata = { title: "AI answers" };

export default async function VisibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run: runParam } = await searchParams;
  const { session, project } = await requireAppProject(id);
  const [runs, expert, prompts] = await Promise.all([
    db.visibilityRun.findMany({
      where: { organizationId: session.organizationId, projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getExpertMode(session),
    db.trackedPrompt.findMany({
      where: { organizationId: session.organizationId, projectId: project.id },
      orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true, active: true },
    }),
  ]);
  const active = runs.some((r) => isActiveStatus(r.status));
  const canEdit = hasRole(session, "member");
  // Only the engines this plan asks per check (S1 hook).
  const engines: PublicProvider[] | null = await describeProviders({ maxProviders: await getOrgEngineLimit(session.organizationId).catch(() => undefined) })
    .then((d) => d.providers.map(({ id, label, configured, enabled, active: on, simulated }) => ({ id, label, configured, enabled, active: on, simulated })))
    .catch(() => null);
  const run =
    runs.find((r) => r.id === runParam) ??
    runs.find((r) => r.status === "succeeded" || r.status === "succeeded_with_warnings") ??
    runs[0] ??
    null;

  const observations = run
    ? await db.observation.findMany({
        where: { organizationId: session.organizationId, visibilityRunId: run.id },
        include: { prompt: { select: { id: true, text: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const rows: ObservationRow[] = observations.map((o) => ({
    id: o.id,
    prompt: o.prompt.text,
    provider: o.provider,
    platformLabel: o.platformLabel,
    model: o.model,
    brandMentioned: o.brandMentioned,
    brandCited: o.brandCited,
    brandRecommended: o.brandRecommended,
    competitorMentions: asRecord<number>(o.competitorMentions),
    sentiment: o.sentiment,
    parseConfidence: o.parseConfidence,
    rawResponse: o.rawResponse,
    citations: asArray<ObservationRow["citations"][number]>(o.citations),
    limitations: o.limitations,
    simulated: o.simulated,
  }));
  const answerRows: AnswerObservation[] = observations.map((o) => ({
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
  }));
  const questions = groupByQuestion(answerRows, strings(project.brandNames));
  const counted = questions.flatMap((q) => q.answers);
  const namedTotal = counted.filter((a) => a.brandMentioned).length;
  // The AI tools this check actually used, by product name.
  const engineList = joinNames(runProviders(run?.providers).map(engineName));
  // Wrong facts: from this check, else the newest check that looked for them.
  const facts = runs.map((r) => wrongFacts(r.metrics)).find((f) => f.length) ?? [];
  const runFacts = wrongFacts(run?.metrics);
  const shownFacts = runFacts.length ? runFacts : facts;
  const m = readMetrics(run?.metrics);
  const simulated = m?.simulated || rows.some((r) => r.simulated);
  const sources = [...(m?.citationSources ?? [])].sort((a, b) => b.count - a.count).slice(0, 20);
  const maxSource = sources[0]?.count ?? 1;
  const footer = m ? `Out of ${m.collected} answers` : undefined;
  const providerRows = m ? Object.entries(m.byProvider) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI Answers"
        title="AI answers"
        description="What AI tools say when your customers ask them questions — and whether they name you."
        actions={
          <>
            <AutoRefresh active={active} label="Collecting AI answers" />
            {expert && (
              <LinkButton href={`/app/projects/${project.id}/report#ai-visibility`} variant="secondary" icon={<FileText />}>
                See in full report
              </LinkButton>
            )}
            {run && (
              <RunButtons
                projectId={project.id}
                crawlActive={false}
                visibilityActive={active}
                canRun={canEdit}
                show={["visibility"]}
                labels={{ visibility: "Check AI" }}
              />
            )}
          </>
        }
      />
      {expert && engines && <ProvidersStatus providers={engines} />}
      {simulated && (
        <SimulatedDataBanner>
          these are sample answers, not real ones from AI tools. Real answers appear once AI checks are switched on — contact us if
          you need help.
        </SimulatedDataBanner>
      )}

      {!run ? (
        <EmptyState
          icon={<MessageSquare />}
          title="AI tools haven't been asked about you yet."
          action={
            <RunButtons
              projectId={project.id}
              crawlActive={false}
              visibilityActive={active}
              canRun={canEdit}
              show={["visibility"]}
              labels={{ visibility: "Check AI" }}
            />
          }
          bordered
        />
      ) : (
        <>
          <section aria-labelledby="aa-headline" className="space-y-1">
            <h2 id="aa-headline" className="text-h3 text-balance text-fg">
              {counted.length === 0
                ? isActiveStatus(run.status)
                  ? "Collecting AI answers…"
                  : "This AI check didn't get any answers."
                : `AI named you in ${namedTotal} of ${counted.length} ${counted.length === 1 ? "answer" : "answers"}.`}
            </h2>
            <p className="text-small text-muted">
              Checked {fmtDate(run.finishedAt ?? run.createdAt)}. Tap a question to read what AI said.
            </p>
          </section>

          {(questions.length > 0 || prompts.length > 0) && (
            <div className="space-y-2">
              <AnswersList projectId={project.id} questions={questions} prompts={prompts} canEdit={canEdit} brandNames={strings(project.brandNames)} runId={runParam ? run?.id : null} />
              {questions.length > 0 && (
                <p className="text-xs text-muted">
                  Checked {questions.length} {questions.length === 1 ? "question" : "questions"}
                  {engineList ? ` on ${engineList}` : ""}.
                  {run.failed > 0 && ` ${run.collected} of ${run.sampleSize} answers came back.`}
                </p>
              )}
            </div>
          )}

          <WrongFacts projectId={project.id} facts={shownFacts} canEdit={canEdit} />

          {expert && (
            <>
          <nav aria-label="Choose a check" className="flex flex-wrap items-center gap-2">
            <span className="text-caption uppercase tracking-[0.06em] text-muted">Check from</span>
            {runs.slice(0, 8).map((r) => (
              <Link
                key={r.id}
                href={`?run=${r.id}`}
                aria-current={r.id === run.id ? "true" : undefined}
                className={clsx(
                  "focus-ring inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                  r.id === run.id ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:bg-surface-2",
                )}
              >
                {fmtDate(r.createdAt, true)}
                {r.status !== "succeeded" && <span className="capitalize text-muted">· {r.status.replace(/_/g, " ")}</span>}
              </Link>
            ))}
          </nav>

          <section aria-label="Check summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Answers collected"
              value={
                <span className="tabular-nums">
                  {run.collected}
                  <span className="text-small font-normal text-muted"> / {run.sampleSize}</span>
                </span>
              }
              hint={run.failed ? `${run.failed} couldn't be collected` : "Every question, asked to every AI tool"}
              footer={<StatusBadge status={run.status} />}
              icon={<ListChecks />}
            />
            <Stat label="Named you" value={pct(m?.mentionRate)} hint="Answers that name your business" footer={footer} icon={<MessageSquare />} />
            <Stat label="Linked to your site" value={pct(m?.citationRate)} hint="Answers that link to one of your pages" footer={footer} icon={<Link2 />} />
            <Stat label="Recommended" value={pct(m?.recommendationRate)} hint="Answers that suggest you" footer={footer} icon={<ThumbsUp />} />
          </section>

          {providerRows.length > 1 && (
            <Card>
              <CardHeader title="By AI tool" description="Different AI tools can answer the same question very differently." />
              <Table caption="Results by AI tool" density="compact">
                <THead>
                  <tr>
                    <TH>AI tool</TH>
                    <TH align="right">Answers</TH>
                    <TH>Named you</TH>
                    <TH>Linked to your site</TH>
                  </tr>
                </THead>
                <tbody>
                  {providerRows.map(([p, v]) => (
                    <TR key={p}>
                      <TD className="font-medium text-fg">{engineName(p)}</TD>
                      <TD numeric>{v.collected}</TD>
                      <TD>
                        <div className="flex max-w-56 items-center gap-2">
                          <Meter value={Math.round(v.mentionRate * 100)} max={100} label={`${engineName(p)}: answers that named you`} tone="primary" />
                          <span className="w-10 shrink-0 text-xs tabular-nums text-muted">{pct(v.mentionRate)}</span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex max-w-56 items-center gap-2">
                          <Meter value={Math.round(v.citationRate * 100)} max={100} label={`${engineName(p)}: answers linked to your site`} tone="accent" />
                          <span className="w-10 shrink-0 text-xs tabular-nums text-muted">{pct(v.citationRate)}</span>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-4">
            <Card className="xl:col-span-3">
              <CardHeader
                title="Every answer, question by question"
                description="Open a row to read exactly what the AI said and which websites it pointed to."
              />
              {rows.length === 0 ? (
                <CardBody>
                  <EmptyState
                    size="sm"
                    title={isActiveStatus(run.status) ? "Collecting answers…" : "No answers collected"}
                    description={isActiveStatus(run.status) ? "This page updates by itself as answers come in." : "This AI check didn't get any answers. Run the AI check again."}
                  />
                </CardBody>
              ) : (
                <VisibilityTable rows={rows} brandNames={strings(project.brandNames)} />
              )}
            </Card>
            <Card>
              <CardHeader title="Websites AI links to" description="Websites the answers linked to. Yours are highlighted." />
              <CardBody>
                {sources.length === 0 ? (
                  <p className="text-small text-muted">These answers didn&apos;t link to any websites.</p>
                ) : (
                  <ul className="space-y-2">
                    {sources.map((s) => (
                      <li key={s.domain} className={clsx("rounded-lg px-3 py-2", s.owned ? "bg-accent-soft" : "bg-surface-2")}>
                        <div className="flex items-center justify-between gap-2 text-small">
                          <span className={clsx("min-w-0 truncate", s.owned ? "font-semibold text-fg" : "text-fg-soft")}>{s.domain}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {s.owned && (
                              <Badge tone="accent" variant="solid" size="sm">
                                Yours
                              </Badge>
                            )}
                            <span className="tabular-nums text-muted">{s.count}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-score-track" aria-hidden>
                          <div
                            className={clsx("h-full rounded-full", s.owned ? "bg-accent" : "bg-chart-1")}
                            style={{ width: `${Math.max(4, (s.count / maxSource) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
            </>
          )}
          <p className="text-xs text-muted">
            AI answers change from day to day and between AI tools. These numbers describe these answers only; they don&apos;t
            promise how any AI tool will answer in future.
          </p>
        </>
      )}
    </div>
  );
}
