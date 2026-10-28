import { notFound } from "next/navigation";
import Link from "next/link";
import { Activity, AlertOctagon, Building2, Coins, Flag, LifeBuoy, ShieldAlert, Webhook } from "lucide-react";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/auth/staff";
import { FLAG_DEFAULTS, isEnabled } from "@/lib/flags";
import { billingPeriod } from "@/lib/billing/usage";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  ToastProvider,
} from "@/components/ui";
import { FlagToggles, OrgControls, SupportAccess } from "./admin-client";
import { LogoLockup, LogoMark } from "@/components/brand/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff admin" };

const fmtDate = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16);

export default async function AdminPage() {
  const staff = await getStaffUser();
  if (!staff) notFound(); // don't reveal the admin surface to non-staff

  const period = billingPeriod();
  const [orgs, failedRuns, queue, costs, webhooks, storedFlags] = await Promise.all([
    db.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        planId: true,
        status: true,
        publishingEnabled: true,
        createdAt: true,
        _count: { select: { memberships: true, projects: true } },
      },
    }),
    db.workflowRun.findMany({
      where: { state: { in: ["failed", "rollback_failed"] } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, organizationId: true, kind: true, state: true, error: true, errorClass: true, attempts: true, updatedAt: true },
    }),
    db.workflowRun.groupBy({ by: ["state"], _count: { _all: true } }),
    db.usageLedger.groupBy({
      by: ["provider"],
      where: { billingPeriod: period, kind: "actual" },
      _sum: { costMicros: true, credits: true },
    }),
    db.webhookEvent.findMany({
      orderBy: { processedAt: "desc" },
      take: 20,
      select: { id: true, provider: true, eventId: true, type: true, processedAt: true },
    }),
    db.featureFlag.findMany(),
  ]);

  const flagKeys = [...new Set([...Object.keys(FLAG_DEFAULTS), ...storedFlags.map((f) => f.key)])].sort();
  const flags = await Promise.all(
    flagKeys.map(async (key) => ({ key, enabled: await isEnabled(key), isDefault: !storedFlags.some((f) => f.key === key) })),
  );
  const sortedQueue = [...queue].sort((a, b) => a.state.localeCompare(b.state));
  const totalCost = costs.reduce((a, c) => a + (c._sum.costMicros ?? 0), 0) / 1_000_000;
  const globalPublishing = flags.find((f) => f.key === "global.publishing")?.enabled ?? true;
  const activeJobs = queue
    .filter((q) => ["queued", "preflight", "running", "retry_scheduled", "validating", "executing"].includes(q.state))
    .reduce((a, q) => a + q._count._all, 0);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
          <div className="container-page flex h-16 items-center justify-between gap-3">
            <Link href="/admin" className="flex items-center gap-2.5 text-h4 tracking-tight text-fg">
              <span className="hidden sm:inline-flex"><LogoLockup size="sm" /></span>
              <span className="sm:hidden"><LogoMark size={26} /></span>
              <Badge tone="danger" size="sm" icon={<ShieldAlert />}>
                Staff
              </Badge>
            </Link>
            <span className="truncate text-xs text-muted">
              <span className="hidden sm:inline">Signed in as </span>
              <span className="font-medium text-fg-soft">{staff.user.email}</span>
            </span>
          </div>
        </header>

        <main className="container-page space-y-8 py-8">
          <PageHeader
            title="Staff admin"
            description="Platform health, tenants and safety switches. Every action here is written to the audit log."
            meta={
              <Badge tone={globalPublishing ? "success" : "danger"} variant="dot">
                Global publishing {globalPublishing ? "on" : "off"}
              </Badge>
            }
            className="mb-0"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Organizations" value={orgs.length} icon={<Building2 />} hint={orgs.length === 100 ? "Showing newest 100" : undefined} />
            <Stat label="Active jobs" value={activeJobs} icon={<Activity />} />
            <Stat label="Failed runs" value={failedRuns.length} icon={<AlertOctagon />} hint="Most recent 25" />
            <Stat label={`Provider cost · ${period}`} value={`$${totalCost.toFixed(2)}`} icon={<Coins />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-1">
              <Card>
                <CardHeader icon={<Flag />} title="Kill switches & flags" description="Changes apply immediately." />
                <CardBody>
                  <FlagToggles initial={flags} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader icon={<Activity />} title="Queue depth" description="Workflow runs by state." />
                {sortedQueue.length === 0 ? (
                  <EmptyState size="sm" title="No workflow runs" />
                ) : (
                  <Table caption="Workflow runs by state" density="compact">
                    <THead>
                      <tr>
                        <TH>State</TH>
                        <TH align="right">Runs</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {sortedQueue.map((q) => (
                        <TR key={q.state}>
                          <TD>
                            <StatusBadge status={q.state} />
                          </TD>
                          <TD numeric>{q._count._all.toLocaleString()}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader icon={<Coins />} title="Provider usage" description={`Actual cost for ${period}.`} />
                {costs.length === 0 ? (
                  <EmptyState size="sm" title="No usage recorded" />
                ) : (
                  <Table caption="Provider usage cost" density="compact">
                    <THead>
                      <tr>
                        <TH>Provider</TH>
                        <TH align="right">Cost</TH>
                        <TH align="right">Credits</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {costs.map((c) => (
                        <TR key={c.provider}>
                          <TD className="font-medium text-fg">{c.provider}</TD>
                          <TD numeric>${((c._sum.costMicros ?? 0) / 1_000_000).toFixed(2)}</TD>
                          <TD numeric>{(c._sum.credits ?? 0).toLocaleString()}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader icon={<LifeBuoy />} title="Support access" description="Read-only view of a tenant. Every request is logged." />
                <CardBody>
                  <SupportAccess />
                </CardBody>
              </Card>
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Card>
                <CardHeader icon={<Building2 />} title="Organizations" description={`${orgs.length} newest tenants. Toggle publishing per tenant.`} />
                {orgs.length === 0 ? (
                  <EmptyState size="sm" title="No organizations yet" />
                ) : (
                  <Table caption="Organizations" stickyHeader zebra maxHeight="36rem">
                    <THead>
                      <tr>
                        <TH>Organization</TH>
                        <TH>Plan</TH>
                        <TH>Status</TH>
                        <TH align="right">Members</TH>
                        <TH align="right">Projects</TH>
                        <TH>Created</TH>
                        <TH>Publishing</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {orgs.map((o) => (
                        <TR key={o.id}>
                          <TD>
                            <div className="font-medium text-fg">{o.name}</div>
                            <div className="font-mono text-xs text-muted">{o.id}</div>
                          </TD>
                          <TD>
                            <Badge tone={o.planId === "trial" ? "warning" : "primary"} size="sm" className="capitalize">
                              {o.planId}
                            </Badge>
                          </TD>
                          <TD>
                            <Badge tone={o.status === "active" ? "success" : "danger"} variant="dot" size="sm" className="capitalize">
                              {o.status.replace(/_/g, " ")}
                            </Badge>
                          </TD>
                          <TD numeric>{o._count.memberships}</TD>
                          <TD numeric>{o._count.projects}</TD>
                          <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmtDate(o.createdAt)}</TD>
                          <TD>
                            <OrgControls orgId={o.id} orgName={o.name} publishingEnabled={o.publishingEnabled} />
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader icon={<AlertOctagon />} title="Recent failed workflow runs" />
                {failedRuns.length === 0 ? (
                  <EmptyState size="sm" title="No failures" description="Nothing has failed recently." />
                ) : (
                  <Table caption="Recent failed workflow runs" zebra>
                    <THead>
                      <tr>
                        <TH>Run</TH>
                        <TH>Error</TH>
                        <TH align="right">Attempts</TH>
                        <TH>When</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {failedRuns.map((r) => (
                        <TR key={r.id}>
                          <TD>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-fg">{r.kind}</span>
                              <StatusBadge status={r.state} />
                              {r.errorClass && (
                                <Badge tone="warning" size="sm">
                                  {r.errorClass}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-muted">org {r.organizationId}</div>
                          </TD>
                          <TD className="max-w-xs">
                            <span className="line-clamp-2 text-xs text-fg-soft" title={r.error ?? undefined}>
                              {r.error ?? "No error message"}
                            </span>
                          </TD>
                          <TD numeric>{r.attempts}</TD>
                          <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmtDate(r.updatedAt)}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader icon={<Webhook />} title="Recent webhook events" />
                {webhooks.length === 0 ? (
                  <EmptyState size="sm" title="No webhook events yet" />
                ) : (
                  <Table caption="Recent webhook events" density="compact" zebra>
                    <THead>
                      <tr>
                        <TH>Provider</TH>
                        <TH>Type</TH>
                        <TH>Event id</TH>
                        <TH>Processed</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {webhooks.map((w) => (
                        <TR key={w.id}>
                          <TD className="font-medium text-fg">{w.provider}</TD>
                          <TD>{w.type}</TD>
                          <TD className="font-mono text-xs text-muted">{w.eventId.slice(0, 24)}</TD>
                          <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmtDate(w.processedAt)}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
