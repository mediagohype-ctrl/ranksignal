// Jobs: WorkflowRun explorer with filters (kind, state, org, date) and queue depth.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Activity } from "lucide-react";
import { db } from "@/lib/db";
import { WORKFLOW_STATES } from "@/lib/types";
import { requireStaffPage } from "@/lib/admin/guard";
import { orgNames } from "@/lib/admin/metrics";
import { dateRangeWhere, fmtAgo, fmtDateTime, pageParams, qs, str, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, EmptyState, PageHeader, StatusBadge, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, Mono, Pagination } from "@/components/admin/ui";
import { JobActions } from "@/components/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

const KINDS = ["crawl", "visibility", "analyze", "execute_action", "rollback"];

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp);
  const where: Prisma.WorkflowRunWhereInput = {};
  const kind = str(sp, "kind");
  if (kind) where.kind = kind;
  const state = str(sp, "state");
  if (state) where.state = state;
  const org = str(sp, "org");
  if (org) where.organizationId = org;
  const created = dateRangeWhere(sp);
  if (created) where.createdAt = created;

  const [runs, total, depth] = await Promise.all([
    db.workflowRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        kind: true,
        state: true,
        attempts: true,
        maxAttempts: true,
        error: true,
        errorClass: true,
        runAfter: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.workflowRun.count({ where }),
    db.workflowRun.groupBy({ by: ["state"], _count: { _all: true } }),
  ]);
  const names = await orgNames(runs.map((r) => r.organizationId));
  const depthSorted = [...depth].sort((a, b) => b._count._all - a._count._all);

  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="Jobs" description="Every workflow run (crawls, AI checks, analysis, publishing, rollbacks). Retry failed runs or cancel queued ones." />
      <nav aria-label="Runs by state" className="flex flex-wrap gap-2">
        {depthSorted.map((d) => (
          <Link
            key={d.state}
            href={`/admin/jobs${qs(sp, { state: state === d.state ? undefined : d.state, page: undefined })}`}
            aria-current={state === d.state ? "true" : undefined}
            className={
              state === d.state
                ? "inline-flex items-center gap-2 rounded-full border border-primary bg-primary-soft px-3 py-1 text-small"
                : "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-small hover:bg-surface-2"
            }
          >
            <StatusBadge status={d.state} />
            <span className="font-semibold tabular-nums text-fg">{d._count._all.toLocaleString()}</span>
          </Link>
        ))}
      </nav>
      <Card>
        <FilterBar action="/admin/jobs" resetHref="/admin/jobs">
          <FilterSelect name="kind" label="Kind" defaultValue={kind} options={KINDS} />
          <FilterSelect name="state" label="State" defaultValue={state} options={[...WORKFLOW_STATES]} />
          <FilterInput name="org" label="Organization id" defaultValue={org} placeholder="cl…" />
          <FilterInput name="from" label="From" type="date" defaultValue={str(sp, "from")} />
          <FilterInput name="to" label="To" type="date" defaultValue={str(sp, "to")} />
        </FilterBar>
        {runs.length === 0 ? (
          <EmptyState icon={<Activity />} title="No jobs match" />
        ) : (
          <Table caption="Jobs" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>Job</TH>
                <TH>Organization</TH>
                <TH>State</TH>
                <TH>Error</TH>
                <TH align="right">Attempts</TH>
                <TH>Created</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <tbody>
              {runs.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/admin/jobs/${r.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {r.kind}
                    </Link>
                    <div>
                      <Mono>{r.id}</Mono>
                    </div>
                  </TD>
                  <TD>
                    <Link href={`/admin/customers/${r.organizationId}`} className="text-fg-soft hover:text-primary hover:underline">
                      {names.get(r.organizationId) ?? r.organizationId}
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={r.state} />
                      {r.state === "retry_scheduled" && <span className="text-xs text-muted">next {fmtAgo(r.runAfter)}</span>}
                    </div>
                  </TD>
                  <TD className="max-w-sm">
                    {r.errorClass && (
                      <Badge tone="warning" size="sm" className="mb-1">
                        {r.errorClass}
                      </Badge>
                    )}
                    <span className="line-clamp-2 text-xs text-fg-soft" title={r.error ?? undefined}>
                      {r.error ?? "—"}
                    </span>
                  </TD>
                  <TD numeric>
                    {r.attempts}/{r.maxAttempts}
                  </TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(r.createdAt)}</TD>
                  <TD>
                    <JobActions id={r.id} state={r.state} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/jobs" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
