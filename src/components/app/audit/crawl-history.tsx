import { History } from "lucide-react";
import { fmtDate, isActiveStatus } from "@/lib/dashboard/format";
import { Card, CardHeader, EmptyState, Meter, StatusBadge, Table, TD, TH, THead, TR } from "@/components/ui";

export interface CrawlRunView {
  id: string;
  status: string;
  pagesFound: number;
  pagesCrawled: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Plain-language status line for the error column (raw job errors can be technical). */
function errorText(e: string | null): string {
  if (!e) return "";
  return e.length > 160 ? `${e.slice(0, 157)}…` : e;
}

export function CrawlHistory({ runs }: { runs: CrawlRunView[] }) {
  return (
    <Card>
      <CardHeader
        icon={<History />}
        title="Crawl history"
        description="Each crawl reads your pages the way a search engine would. Most recent first."
      />
      {runs.length === 0 ? (
        <EmptyState size="sm" title="No crawls yet" description="Start an audit and your crawls will be listed here." />
      ) : (
        <Table caption="Crawl history" density="compact">
          <THead>
            <tr>
              <TH>Started</TH>
              <TH>Status</TH>
              <TH>Pages read</TH>
              <TH className="hidden md:table-cell">Took</TH>
              <TH className="hidden lg:table-cell">Notes</TH>
            </tr>
          </THead>
          <tbody>
            {runs.map((c) => {
              const active = isActiveStatus(c.status);
              const total = Math.max(c.pagesFound, c.pagesCrawled);
              return (
                <TR key={c.id}>
                  <TD className="whitespace-nowrap text-fg">{fmtDate(c.createdAt, true)}</TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  <TD className="min-w-40">
                    {active && total > 0 ? (
                      <Meter value={c.pagesCrawled} max={total} label={`Crawl progress: ${c.pagesCrawled} of ${total} pages`} tone="primary" showValue />
                    ) : (
                      <span className="tabular-nums">
                        {c.pagesCrawled}
                        {c.pagesFound > 0 && <span className="text-muted"> of {c.pagesFound} found</span>}
                      </span>
                    )}
                  </TD>
                  <TD className="hidden whitespace-nowrap tabular-nums text-muted md:table-cell">
                    {active ? "Running…" : duration(c.startedAt ?? c.createdAt, c.finishedAt)}
                  </TD>
                  <TD className="hidden max-w-sm text-caption lg:table-cell">
                    {c.error ? <span className="text-danger">{errorText(c.error)}</span> : <span className="text-muted">—</span>}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
