import { Bot, CheckCircle2, CircleHelp, Link2, MessageSquare, Radar, ThumbsUp, TriangleAlert } from "lucide-react";
import type { AiVisibilitySummary } from "@/lib/report/types";
import { fmtDate, pct } from "@/lib/dashboard/format";
import { ShareBarChart } from "@/components/app/charts";
import { RunButtons } from "@/components/app/run-buttons";
import {
  Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, SimulatedDataBanner, Stat,
} from "@/components/ui";

/** AI visibility block of the site report: rates, competitor share, cited domains, missing prompts, brand knowledge. */
export function AiVisibilitySection({
  ai,
  brand,
  projectId,
  canRun,
  visibilityActive,
}: {
  ai: AiVisibilitySummary;
  brand: string;
  projectId: string;
  canRun: boolean;
  visibilityActive: boolean;
}) {
  if (!ai.measured) {
    return (
      <EmptyState
        icon={<Radar />}
        title={visibilityActive ? "Asking AI assistants about you…" : "We haven't asked AI assistants about you yet"}
        description={
          visibilityActive
            ? "We're sending your tracked questions to AI assistants. This section fills in automatically when the answers are in."
            : "Run an AI visibility check to see whether assistants like ChatGPT and Gemini mention, cite and recommend your business."
        }
        action={
          <span className="no-print inline-flex">
            <RunButtons projectId={projectId} crawlActive={false} visibilityActive={visibilityActive} canRun={canRun} show={["visibility"]} />
          </span>
        }
        secondaryAction={
          <LinkButton href={`/app/projects/${projectId}/prompts`} variant="ghost" className="no-print">
            Choose the questions we ask
          </LinkButton>
        }
        bordered
      />
    );
  }

  const n = ai.collected ?? ai.sampleSize;
  const sampleHint = `Out of ${n} AI ${n === 1 ? "answer" : "answers"}`;
  const providers = ai.providers.length ? ai.providers.join(", ") : "—";
  const footer = `${providers}${ai.measuredAt ? ` · ${fmtDate(ai.measuredAt)}` : ""}`;
  const shareData = [
    ...(ai.brandShare !== undefined && ai.brandShare !== null ? [{ name: brand, share: ai.brandShare }] : []),
    ...ai.topCompetitors.filter((c) => c.name.toLowerCase() !== brand.toLowerCase()),
  ];
  const domains = [...ai.topCitedDomains].sort((a, b) => b.count - a.count).slice(0, 12);
  const maxDomain = domains[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {ai.simulated && (
        <SimulatedDataBanner>
          these AI answers came from the built-in simulator, not from real AI assistants, so treat the numbers as a demo. To get
          real answers, add a <code className="font-mono text-xs">GEMINI_API_KEY</code> to your <code className="font-mono text-xs">.env</code>{" "}
          file, restart the app and run &ldquo;Check AI visibility&rdquo; again.
        </SimulatedDataBanner>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Mentioned"
          value={pct(ai.mentionRate)}
          hint={`${sampleHint} named your brand`}
          footer={footer}
          icon={<MessageSquare />}
        />
        <Stat
          label="Linked to your site"
          value={pct(ai.citationRate)}
          hint={`${sampleHint} cited a page on your website`}
          footer={footer}
          icon={<Link2 />}
        />
        <Stat
          label="Recommended"
          value={pct(ai.recommendationRate)}
          hint={`${sampleHint} actively suggested you`}
          footer={footer}
          icon={<ThumbsUp />}
        />
        <Stat
          label="Visibility index"
          value={
            ai.visibilityIndex === null ? (
              "—"
            ) : (
              <>
                {Math.round(ai.visibilityIndex)}
                <span className="text-small font-normal text-muted"> / 100</span>
              </>
            )
          }
          hint="One number combining the three rates"
          footer={`${ai.sampleSize} questions asked`}
          icon={<Radar />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader
            title="You vs competitors"
            description="Share of all brand mentions in the AI answers we collected. Your brand is shown in teal."
          />
          <CardBody>
            {shareData.length > 0 ? (
              <ShareBarChart data={shareData} brand={[brand]} />
            ) : (
              <EmptyState
                size="sm"
                title="No competitor data yet"
                description="Add competitors to your project so we can compare how often AI mentions them."
              />
            )}
          </CardBody>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader
            title="Websites AI cites most"
            description="Sources AI assistants linked to when answering. Pages on your own site are highlighted."
          />
          <CardBody>
            {domains.length === 0 ? (
              <p className="text-small text-muted">The AI answers we collected didn&apos;t cite any websites.</p>
            ) : (
              <ul className="space-y-2">
                {domains.map((d) => (
                  <li
                    key={d.domain}
                    className={`rounded-lg px-3 py-2 ${d.owned ? "bg-accent-soft" : "bg-surface-2"}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-small">
                      <span className={`min-w-0 truncate ${d.owned ? "font-semibold text-fg" : "text-fg-soft"}`}>{d.domain}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {d.owned && (
                          <Badge tone="accent" variant="solid" size="sm">
                            Your site
                          </Badge>
                        )}
                        <span className="tabular-nums text-muted">
                          {d.count} {d.count === 1 ? "cite" : "cites"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-score-track" aria-hidden>
                      <div
                        className={`h-full rounded-full ${d.owned ? "bg-accent" : "bg-chart-1"}`}
                        style={{ width: `${Math.max(4, (d.count / maxDomain) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="break-inside-avoid">
        <CardHeader
          icon={<CircleHelp />}
          title="Questions where AI doesn't mention you"
          description="Real questions we asked. These are your biggest openings — especially where a competitor was named instead."
        />
        {ai.promptsWhereMissing.length === 0 ? (
          <CardBody>
            <p className="flex items-center gap-2 text-small text-fg-soft">
              <CheckCircle2 aria-hidden size={16} className="text-success" />
              You were mentioned in at least one answer to every question we asked.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {ai.promptsWhereMissing.map((p, i) => (
              <li key={`${p.prompt}-${i}`} className="px-5 py-3.5 sm:px-6">
                <p className="text-small font-medium text-fg">&ldquo;{p.prompt}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">
                  {p.competitorsMentioned.length > 0 ? (
                    <>
                      Mentioned instead:{" "}
                      {p.competitorsMentioned.map((c) => (
                        <Badge key={c} tone="warning" size="sm" className="mr-1">
                          {c}
                        </Badge>
                      ))}
                    </>
                  ) : (
                    "No tracked competitor was mentioned either."
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ai.brandKnowledge && ai.brandKnowledge.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-h4 text-fg">What AI says about your brand</h3>
          <p className="-mt-2 text-small text-muted">
            We asked each assistant what it knows about {brand}. Wrong facts here are worth correcting on your site and profiles.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {ai.brandKnowledge.map((k, i) => (
              <Card key={`${k.provider}-${i}`} padding="md" as="article" className="break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-h4 text-fg">
                    <Bot aria-hidden size={18} className="text-primary" />
                    {k.provider}
                  </span>
                  {k.knowsBrand ? (
                    <Badge tone="success" icon={<CheckCircle2 />}>
                      Knows your brand
                    </Badge>
                  ) : (
                    <Badge tone="warning" icon={<TriangleAlert />}>
                      Doesn&apos;t know you yet
                    </Badge>
                  )}
                </div>
                {/* Provider text is untrusted: rendered as plain text only. */}
                <p className="mt-3 whitespace-pre-line text-small leading-relaxed text-fg-soft">{k.summary || "No description returned."}</p>
                {k.inaccuracies.length > 0 && (
                  <div className="mt-4 rounded-xl bg-danger-soft px-4 py-3">
                    <h4 className="text-caption uppercase tracking-[0.06em] text-danger">Possible inaccuracies</h4>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-small text-fg-soft">
                      {k.inaccuracies.map((x, j) => (
                        <li key={j}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
