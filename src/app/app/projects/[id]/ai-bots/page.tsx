import Link from "next/link";
import clsx from "clsx";
import { Bot, FileUp, Lightbulb, Radio } from "lucide-react";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate } from "@/lib/dashboard/format";
import { addDays, buildDashboard, chartSeries, type BotSummary } from "@/lib/ai-bots-analytics/insights";
import { loadDailyRows } from "@/lib/ai-bots-analytics/store";
import { aiBotLimitsFor } from "@/lib/ai-bots-analytics/limits";
import { cloudflareWorkerSnippet } from "@/lib/ai-bots-analytics/ingest";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, TD, TH, THead, TR } from "@/components/ui";
import { UploadLog } from "./upload-log";
import { CopyBlock, IngestToken } from "./ingest-token";
import { BotVisitsChart } from "./bot-chart";

export const metadata = { title: "AI crawler visits" };

const RANGES = [7, 30, 90] as const;
const n = (x: number) => x.toLocaleString("en-IN");

function statusSummary(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, c]) => `${code}: ${n(c)}`)
    .join(" · ");
}

function Verification({ b }: { b: BotSummary }) {
  if (!b.verifiable || b.verifiedHits + b.unverifiedHits === 0) {
    return <Badge tone="neutral" title="Identified from the user agent only. Anyone can claim to be this bot.">Claimed by user agent</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {b.verifiedHits > 0 && <Badge tone="success" title={`IP address inside ${b.owner}'s published list`}>{n(b.verifiedHits)} verified</Badge>}
      {b.unverifiedHits > 0 && (
        <Badge tone="warning" title="IP address outside the operator's published list: a fake bot, or your logs show your CDN's address">
          {n(b.unverifiedHits)} not from {b.owner}&apos;s IPs
        </Badge>
      )}
    </span>
  );
}

export default async function AiBotsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const { id } = await params;
  const { days: daysParam } = await searchParams;
  const { session, project } = await requireAppProject(id);
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;
  const scope = { organizationId: session.organizationId, projectId: project.id };

  const [org, latest, ingestKey, imports] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true } }),
    db.aiBotDaily.findFirst({ where: scope, orderBy: { date: "desc" }, select: { date: true } }),
    db.aiBotIngestKey.findFirst({ where: scope, select: { tokenPrefix: true, lastUsedAt: true } }),
    db.aiBotLogImport.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const limits = aiBotLimitsFor(org?.planId);
  // Window ends on the newest day we have (uploaded logs are often a few days old).
  const end = latest?.date ?? new Date().toISOString().slice(0, 10);
  const rows = latest ? await loadDailyRows(scope, addDays(end, -(days - 1))) : [];
  const dash = buildDashboard(rows);
  const chart = chartSeries(dash);
  const canUpload = hasRole(session, "member") && !session.readOnly;
  const canManage = hasRole(session, "admin") && !session.readOnly;
  const ingestUrl = `${BRAND.appUrl.replace(/\/$/, "")}/api/projects/${project.id}/ai-bots/ingest`;
  const aiBots = dash.bots.filter((b) => b.ai);
  const searchBots = dash.bots.filter((b) => !b.ai);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI crawlers"
        title="AI crawler visits"
        description="Which AI tools (ChatGPT, Claude, Perplexity and others) actually read your website, which pages they read, and whether they hit errors."
        icon={<Bot />}
      />

      <Notice tone="info" title="Why we need your server logs">
        AI crawlers don&apos;t run JavaScript, so Google Analytics and similar tools never see them. Your web server&apos;s access log does. We
        read it once, keep only daily counts per crawler and the most-read pages, and throw the log lines away. IP addresses and
        query strings are never stored.
      </Notice>

      <Card>
        <CardHeader icon={<FileUp />} title="Upload an access log" description="Apache or Nginx access logs (combined format), or JSON logs such as Cloudflare Logpush. .log or .gz, up to 50 MB." />
        <CardBody className="space-y-4">
          {canUpload ? <UploadLog projectId={project.id} /> : <p className="text-small text-muted">Ask a team member with edit access to upload a log.</p>}
          <details className="text-small text-fg-soft">
            <summary className="cursor-pointer font-medium text-fg">Where do I find my access log?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>cPanel hosting: Metrics → Raw Access → download the file for your domain (.gz is fine).</li>
              <li>Nginx: usually /var/log/nginx/access.log (older days are access.log.1, access.log.2.gz …).</li>
              <li>Apache: usually /var/log/apache2/access.log or /var/log/httpd/access_log.</li>
              <li>Cloudflare: Logpush (Enterprise) JSON files work, or use live logging below on any plan.</li>
            </ul>
            <p className="mt-2">
              Plan limit: {limits.uploadsPerDay} uploads a day; we keep {limits.historyDays} days of history. Uploading the same file twice is
              ignored, so counts are never doubled.
            </p>
          </details>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Bot />}
          title={latest ? "No crawler visits in this period." : "No crawler visits yet."}
          description="Upload a recent access log (a week or more works best), or turn on live logging below. We'll show which AI tools read your site."
          bordered
        />
      ) : (
        <>
          <nav aria-label="Period" className="flex flex-wrap items-center gap-2">
            <span className="text-caption uppercase tracking-[0.06em] text-muted">Show</span>
            {RANGES.map((d) => (
              <Link
                key={d}
                href={`/app/projects/${project.id}/ai-bots?days=${d}`}
                className={clsx("rounded-full border px-3 py-1 text-small", d === days ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border text-fg-soft hover:bg-surface-2")}
                aria-current={d === days ? "page" : undefined}
              >
                {d} days
              </Link>
            ))}
            <span className="text-small text-muted">
              {dash.from} to {dash.to}
            </span>
          </nav>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="AI crawler visits" value={n(dash.totals.aiHits)} />
            <Stat label="Errors AI crawlers got" value={n(dash.totals.aiErrors)} hint="HTTP 4xx and 5xx" />
            <Stat label="Turned away" value={n(dash.totals.aiBlocked)} hint="401, 403 or 429 (blocked or rate-limited)" />
            <Stat label="Googlebot + Bingbot visits" value={n(dash.totals.searchHits)} hint="For comparison" />
          </div>

          {dash.takeaways.length > 0 && (
            <Card>
              <CardHeader icon={<Lightbulb />} title="What this means" />
              <CardBody>
                <ul className="list-disc space-y-2 pl-5 text-body text-fg-soft">
                  {dash.takeaways.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {chart.bots.length > 0 && (
            <Card>
              <CardHeader title="AI crawler visits per day" description="Each bar is one day; colours are crawlers." />
              <CardBody>
                <BotVisitsChart data={chart.data} bots={chart.bots} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Crawlers" description="Verified means the visit came from an IP address the company publishes for its crawler." />
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Crawler</TH>
                    <TH className="text-right">Visits</TH>
                    <TH>Who it really is</TH>
                    <TH className="text-right">Errors</TH>
                    <TH>Responses</TH>
                    <TH>Last seen</TH>
                  </TR>
                </THead>
                <tbody>
                  {[...aiBots, ...searchBots].map((b) => (
                    <TR key={b.bot}>
                      <TD>
                        <div className="font-medium text-fg">{b.bot}</div>
                        <div className="text-xs text-muted">{b.label}{b.ai ? "" : " · comparison"}</div>
                      </TD>
                      <TD className="text-right tabular-nums">{n(b.hits)}</TD>
                      <TD><Verification b={b} /></TD>
                      <TD className={clsx("text-right tabular-nums", b.errors > 0 && "text-danger")}>{n(b.errors)}</TD>
                      <TD className="text-xs text-fg-soft">{statusSummary(b.statusCounts)}</TD>
                      <TD className="whitespace-nowrap text-small">{b.lastSeen}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Pages each crawler reads" description="The most-read pages per crawler in this period. Pages with errors are marked." />
            <CardBody className="space-y-3">
              {dash.bots.filter((b) => b.topPaths.length > 0).map((b) => (
                <details key={b.bot} className="rounded-xl border border-border p-3" open={b === aiBots[0]}>
                  <summary className="cursor-pointer text-small font-medium text-fg">
                    {b.bot} <span className="font-normal text-muted">· {n(b.hits)} visits</span>
                  </summary>
                  <ol className="mt-3 space-y-1.5">
                    {b.topPaths.slice(0, 15).map((p) => (
                      <li key={p.path} className="flex items-baseline justify-between gap-3 text-small">
                        <span className="min-w-0 break-all font-mono text-xs text-fg-soft">{p.path}</span>
                        <span className="shrink-0 tabular-nums text-fg">
                          {n(p.hits)}
                          {p.errors > 0 && <span className="ml-2 text-danger">{n(p.errors)} errors</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </CardBody>
          </Card>
        </>
      )}

      {imports.length > 0 && (
        <Card>
          <CardHeader title="Recent uploads" />
          <CardBody>
            <ul className="space-y-2 text-small text-fg-soft">
              {imports.map((i) => (
                <li key={i.id}>
                  {fmtDate(i.createdAt)}: {i.fileName ?? "log file"}: {n(i.linesTotal)} lines, {n(i.botHits)} crawler visits
                  {i.firstDate ? ` (${i.firstDate}${i.lastDate && i.lastDate !== i.firstDate ? ` to ${i.lastDate}` : ""})` : ""}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<Radio />}
          eyebrow="Advanced"
          title="Live logging with a Cloudflare Worker"
          description="If your site is behind Cloudflare, a small Worker can send each AI crawler visit to us as it happens. Visitors are not slowed down."
        />
        <CardBody className="space-y-5">
          {limits.ingest ? (
            <IngestToken projectId={project.id} prefix={ingestKey?.tokenPrefix ?? null} lastUsedAt={ingestKey?.lastUsedAt?.toISOString() ?? null} canManage={canManage} />
          ) : (
            <p className="text-small text-muted">Live logging is included from the Starter plan. Log uploads work on every plan.</p>
          )}
          <div className="space-y-2">
            <h3 className="text-small font-medium text-fg">Worker code</h3>
            <CopyBlock text={cloudflareWorkerSnippet(ingestUrl)} label="Copy Worker code" />
          </div>
          <details className="text-small text-fg-soft">
            <summary className="cursor-pointer font-medium text-fg">Using another edge platform or your own server?</summary>
            <p className="mt-2">
              POST JSON to <code className="break-all font-mono text-xs">{ingestUrl}</code> with the header{" "}
              <code className="font-mono text-xs">Authorization: Bearer YOUR_TOKEN</code>. Send{" "}
              <code className="font-mono text-xs">{`{ "events": [{ "ip", "path", "status", "userAgent", "time" }] }`}</code> or{" "}
              <code className="font-mono text-xs">{`{ "lines": ["<access log line>", …] }`}</code>, up to 1,000 items and 1 MB per request,
              300 requests a minute. Only send crawler visits; other visits are ignored anyway.
            </p>
          </details>
        </CardBody>
      </Card>
    </div>
  );
}
