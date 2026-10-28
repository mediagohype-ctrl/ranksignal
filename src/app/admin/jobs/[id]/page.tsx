// Job detail: state, timing, error, events timeline and input/output/usage JSON.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { fmtAgo, fmtDateTime } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, EmptyState, KeyValueList, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { JsonView, Mono } from "@/components/admin/ui";
import { JobActions } from "@/components/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job" };

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const run = await db.workflowRun.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" }, take: 500 }, organization: { select: { id: true, name: true } } },
  });
  if (!run) notFound();
  const project = run.projectId ? await db.project.findUnique({ where: { id: run.projectId }, select: { id: true, name: true, websiteUrl: true } }) : null;
  const durationMs = run.updatedAt.getTime() - run.createdAt.getTime();

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        breadcrumbs={[{ label: "Jobs", href: "/admin/jobs" }, { label: run.id }]}
        title={`${run.kind} job`}
        meta={
          <>
            <StatusBadge status={run.state} />
            {run.errorClass && <Badge tone="warning">{run.errorClass}</Badge>}
            <Mono>{run.id}</Mono>
          </>
        }
        actions={<JobActions id={run.id} state={run.state} />}
      />
      {run.error && (
        <Notice tone="danger" title="Error">
          <span className="whitespace-pre-wrap break-words font-mono text-xs">{run.error}</span>
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Run" />
          <CardBody>
            <KeyValueList
              items={[
                {
                  label: "Organization",
                  value: (
                    <Link href={`/admin/customers/${run.organization.id}`} className="text-primary hover:underline">
                      {run.organization.name}
                    </Link>
                  ),
                },
                { label: "Project", value: project ? `${project.name} (${project.websiteUrl})` : (run.projectId ?? "—") },
                { label: "Version", value: run.version },
                { label: "Attempts", value: `${run.attempts} / ${run.maxAttempts}` },
                { label: "Created", value: fmtDateTime(run.createdAt) },
                { label: "Updated", value: `${fmtDateTime(run.updatedAt)} (${Math.round(durationMs / 1000)}s after start)` },
                { label: "Run after", value: `${fmtDateTime(run.runAfter)} (${fmtAgo(run.runAfter)})` },
                { label: "Locked", value: run.lockedAt ? `${fmtAgo(run.lockedAt)} by ${run.lockedBy ?? "?"}` : "No" },
                { label: "Idempotency key", value: run.idempotencyKey ? <Mono>{run.idempotencyKey}</Mono> : "—" },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Events timeline" description={`${run.events.length} events`} />
          {run.events.length === 0 ? (
            <EmptyState size="sm" title="No events recorded" />
          ) : (
            <CardBody>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {run.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
                    <div className="flex flex-wrap items-center gap-2 text-small">
                      <span className="font-mono text-xs font-semibold text-fg">{e.name}</span>
                      {(e.fromState || e.toState) && (
                        <span className="text-xs text-muted">
                          {e.fromState ?? "∅"} → {e.toState ?? "∅"}
                        </span>
                      )}
                      <span className="ml-auto text-xs tabular-nums text-muted">{fmtDateTime(e.createdAt)}</span>
                    </div>
                    {e.data != null && Object.keys(e.data as object).length > 0 && (
                      <div className="mt-1.5">
                        <JsonView label="Event data" value={e.data} maxHeight="12rem" />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardBody>
          )}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <JsonView label="Input" value={run.input} open />
        <JsonView label="Output" value={run.output} open />
        <JsonView label="Usage" value={run.usage} open />
      </div>
    </div>
  );
}
