import Link from "next/link";
import clsx from "clsx";
import { FileText, Link2, ListChecks, MessageSquare, ThumbsUp } from "lucide-react";
import { db } from "@/lib/db";
import { readMetrics } from "@/lib/dashboard/data";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asArray, asRecord, fmtDate, isActiveStatus, pct } from "@/lib/dashboard/format";
import { describeProviders } from "@/lib/providers/visibility/registry";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { ProvidersStatus, type PublicProvider } from "@/components/app/providers-status";
import { RunButtons } from "@/components/app/run-buttons";
import { VisibilityTable, type ObservationRow } from "@/components/app/visibility-table";
import {
  Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Meter, PageHeader, SimulatedDataBanner, Stat, StatusBadge, Table, TD, TH,
  THead, TR,
} from "@/components/ui";

export const metadata = { title: "AI Visibility" };

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
  const runs = await db.visibilityRun.findMany({
    where: { organizationId: session.organizationId, projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const active = runs.some((r) => isActiveStatus(r.status));
  const engines: PublicProvider[] | null = await describeProviders()
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
        include: { prompt: { select: { text: true } } },
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
  const m = readMetrics(run?.metrics);
  const simulated = m?.simulated || rows.some((r) => r.simulated);
  const sources = [...(m?.citationSources ?? [])].sort((a, b) => b.count - a.count).slice(0, 20);
  const maxSource = sources[0]?.count ?? 1;
  const footer = m ? `Out of ${m.collected} answers` : undefined;
  const providerRows = m ? Object.entries(m.byProvider) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Visibility"
        description="We ask AI assistants the questions your customers ask, then check whether they mention you, link to your site and recommend you."
        actions={
          <>
            <AutoRefresh active={active} label="Collecting AI answers" />
            <LinkButton href={`/app/projects/${project.id}/report#ai-visibility`} variant="secondary" icon={<FileText />}>
              See in report
            </LinkButton>
            <RunButtons projectId={project.id} crawlActive={false} visibilityActive={active} canRun={hasRole(session, "member")} show={["visibility"]} />
          </>
        }
      />
      {engines && <ProvidersStatus providers={engines} />}
      {simulated && (
        <SimulatedDataBanner>
          these answers came from the built-in simulator, not real AI assistants. Add a GEMINI_API_KEY to your .env file and run the
          check again for real answers.
        </SimulatedDataBanner>
      )}

      {!run ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No AI visibility checks yet"
          description="Pick the questions your customers ask, then run a check to see how AI assistants answer them."
          action={<LinkButton href={`/app/projects/${project.id}/prompts`} icon={<ListChecks />}>Choose questions</LinkButton>}
          bordered
        />
      ) : (
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
              hint={run.failed ? `${run.failed} couldn't be collected` : "Every question × every AI assistant"}
              footer={<StatusBadge status={run.status} />}
              icon={<ListChecks />}
            />
            <Stat label="Mentioned" value={pct(m?.mentionRate)} hint="Answers that name your brand" footer={footer} icon={<MessageSquare />} />
            <Stat label="Linked to your site" value={pct(m?.citationRate)} hint="Answers citing one of your pages" footer={footer} icon={<Link2 />} />
            <Stat label="Recommended" value={pct(m?.recommendationRate)} hint="Answers suggesting you" footer={footer} icon={<ThumbsUp />} />
          </section>

          {providerRows.length > 1 && (
            <Card>
              <CardHeader title="By AI assistant" description="Different assistants can answer the same question very differently." />
              <Table caption="Results by AI assistant" density="compact">
                <THead>
                  <tr>
                    <TH>AI assistant</TH>
                    <TH align="right">Answers</TH>
                    <TH>Mentioned</TH>
                    <TH>Linked to your site</TH>
                  </tr>
                </THead>
                <tbody>
                  {providerRows.map(([p, v]) => (
                    <TR key={p}>
                      <TD className="font-medium text-fg">{p}</TD>
                      <TD numeric>{v.collected}</TD>
                      <TD>
                        <div className="flex max-w-56 items-center gap-2">
                          <Meter value={Math.round(v.mentionRate * 100)} max={100} label={`${p} mention rate`} tone="primary" />
                          <span className="w-10 shrink-0 text-xs tabular-nums text-muted">{pct(v.mentionRate)}</span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex max-w-56 items-center gap-2">
                          <Meter value={Math.round(v.citationRate * 100)} max={100} label={`${p} citation rate`} tone="accent" />
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
                    description={isActiveStatus(run.status) ? "This page updates by itself as answers come in." : undefined}
                  />
                </CardBody>
              ) : (
                <VisibilityTable rows={rows} />
              )}
            </Card>
            <Card>
              <CardHeader title="Websites AI cites" description="Sources linked across this check. Yours are highlighted." />
              <CardBody>
                {sources.length === 0 ? (
                  <p className="text-small text-muted">No websites were cited in these answers.</p>
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
          <p className="text-xs text-muted">
            AI answers change from day to day and between assistants. These numbers describe this sample of answers; they don&apos;t
            guarantee how any assistant will answer in future.
            {run.promptSetVersion ? ` Question set v${run.promptSetVersion}.` : ""}
          </p>
        </>
      )}
    </div>
  );
}
