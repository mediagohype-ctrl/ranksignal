// Customer (organization) detail with tabs: overview, projects, members, usage & costs, jobs, audit log, notes.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { billingPeriod, getUsageSummary } from "@/lib/billing/usage";
import { accessMessage, getOrgAccess } from "@/lib/billing/access";
import { getPlan } from "@/lib/billing/plans";
import { requireStaffPage } from "@/lib/admin/guard";
import { dailyCostByProvider, userEmails } from "@/lib/admin/metrics";
import { formatInr, formatUsd, isServiceTier, microsToInr, microsToUsd, SERVICE_TIER_PRICES_INR } from "@/lib/admin/money";
import { DAY_MS, fmtAgo, fmtDate, fmtDateTime, oneOf, pageParams, str, type SearchParams } from "@/lib/admin/params";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValueList,
  Meter,
  Notice,
  PageHeader,
  ScoreRing,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { LinkTabs, JsonView, Mono, Pagination, PlanBadge, StatusPill, TierBadge } from "@/components/admin/ui";
import { DailyStackedBars } from "@/components/admin/charts";
import { NotesPanel, OrgActions } from "@/components/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer" };

const TABS = ["overview", "projects", "members", "usage", "jobs", "audit", "notes"] as const;
type Tab = (typeof TABS)[number];

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const tab = oneOf(sp, "tab", TABS, "overview");

  const org = await db.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      region: true,
      planId: true,
      status: true,
      serviceTier: true,
      publishingEnabled: true,
      billingCustomerId: true,
      createdAt: true,
      _count: { select: { memberships: true, projects: true, workflowRuns: true, auditLogs: true } },
    },
  });
  if (!org) notFound();
  const notesCount = await db.adminNote.count({ where: { organizationId: id } });
  const base = `/admin/customers/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: org.name }]}
        title={org.name}
        meta={
          <>
            <PlanBadge planId={org.planId} />
            <TierBadge tier={org.serviceTier} />
            <StatusPill status={org.status} />
            {!org.publishingEnabled && <Badge tone="warning">Publishing paused</Badge>}
            <Mono>{org.id}</Mono>
            <span>· created {fmtDate(org.createdAt)}</span>
          </>
        }
      />
      <Card padding="md">
        <OrgActions
          org={{
            id: org.id,
            name: org.name,
            planId: org.planId,
            serviceTier: org.serviceTier,
            status: org.status,
            publishingEnabled: org.publishingEnabled,
          }}
        />
      </Card>
      <LinkTabs
        label="Customer sections"
        basePath={base}
        sp={{}}
        active={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "projects", label: "Projects", count: org._count.projects },
          { id: "members", label: "Members", count: org._count.memberships },
          { id: "usage", label: "Usage & costs" },
          { id: "jobs", label: "Jobs", count: org._count.workflowRuns },
          { id: "audit", label: "Audit log", count: org._count.auditLogs },
          { id: "notes", label: "Notes", count: notesCount },
        ]}
      />
      <TabBody tab={tab} org={org} sp={sp} base={base} />
    </div>
  );
}

type Org = { id: string; name: string; planId: string; serviceTier: string | null; status: string; region: string; publishingEnabled: boolean; billingCustomerId: string | null; createdAt: Date };

async function TabBody({ tab, org, sp, base }: { tab: Tab; org: Org; sp: SearchParams; base: string }) {
  switch (tab) {
    case "projects":
      return <ProjectsTab orgId={org.id} />;
    case "members":
      return <MembersTab orgId={org.id} />;
    case "usage":
      return <UsageTab orgId={org.id} sp={sp} />;
    case "jobs":
      return <JobsTab orgId={org.id} sp={sp} base={base} />;
    case "audit":
      return <AuditTab orgId={org.id} sp={sp} base={base} />;
    case "notes":
      return <NotesTab orgId={org.id} />;
    default:
      return <OverviewTab org={org} />;
  }
}

/* ------------------------------------------------------------------ overview */

async function OverviewTab({ org }: { org: Org }) {
  const [access, usage, subs, monthCost, lastLogin] = await Promise.all([
    getOrgAccess(org.id),
    getUsageSummary(org.id).catch(() => null),
    db.subscription.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.usageLedger.aggregate({ where: { organizationId: org.id, billingPeriod: billingPeriod(), kind: "actual" }, _sum: { costMicros: true } }),
    db.auditLog.findFirst({ where: { organizationId: org.id, action: "auth.login" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const plan = getPlan(org.planId);
  const micros = monthCost._sum.costMicros ?? 0;
  const tierPrice = isServiceTier(org.serviceTier) ? SERVICE_TIER_PRICES_INR[org.serviceTier] : 0;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Subscription & access" />
        <CardBody className="space-y-4">
          <Notice tone={access.active ? (access.reason ? "warning" : "success") : "danger"} title={access.active ? "Can run scans" : "Scans blocked"}>
            {accessMessage(access)}
          </Notice>
          <KeyValueList
            items={[
              { label: "Plan", value: `${plan.name}${plan.priceInrMonthly ? ` · ${formatInr(plan.priceInrMonthly)}/mo` : ""}` },
              { label: "Service tier", value: org.serviceTier ? `${org.serviceTier} · ${formatInr(tierPrice)}/mo` : "Self-serve" },
              { label: "Org status", value: <StatusPill status={org.status} /> },
              { label: "Trial ends", value: access.trialEndsAt ? `${fmtDate(access.trialEndsAt)} (${fmtAgo(access.trialEndsAt)})` : "—" },
              { label: "Subscription status", value: access.subscriptionStatus ?? "—" },
              { label: "Current period ends", value: fmtDate(access.currentPeriodEnd ?? null) },
              { label: "Billing customer id", value: org.billingCustomerId ? <Mono>{org.billingCustomerId}</Mono> : "—" },
              { label: "Region", value: org.region },
              { label: "Last member sign-in", value: lastLogin ? fmtAgo(lastLogin.createdAt) : "—" },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Usage this month" description={usage?.period} />
        <CardBody className="space-y-5">
          {usage ? (
            <>
              <Meter value={usage.used} max={Math.max(usage.limit, 1)} label={`Credits used · ${usage.used.toLocaleString()} of ${usage.limit.toLocaleString()}`} showValue />
              <KeyValueList
                items={[
                  { label: "Reserved credits", value: usage.reserved.toLocaleString() },
                  ...Object.entries(usage.byTaskType).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: v.toLocaleString() })),
                  { label: "AI / provider cost", value: `${formatUsd(microsToUsd(micros))} (≈ ${formatInr(microsToInr(micros))})` },
                ]}
              />
            </>
          ) : (
            <p className="text-small text-muted">Usage unavailable.</p>
          )}
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Subscription history" description="Newest first (provider rows are written by the Razorpay webhook)." />
        {subs.length === 0 ? (
          <EmptyState size="sm" title="No subscription rows" />
        ) : (
          <Table caption="Subscriptions" density="compact" zebra>
            <THead>
              <tr>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>Provider</TH>
                <TH>Period</TH>
                <TH>Trial ends</TH>
                <TH>Updated</TH>
              </tr>
            </THead>
            <tbody>
              {subs.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <PlanBadge planId={s.planId} />
                  </TD>
                  <TD>
                    <StatusPill status={s.status} />
                  </TD>
                  <TD>
                    {s.provider} {s.providerSubscriptionId && <Mono>{s.providerSubscriptionId}</Mono>}
                  </TD>
                  <TD className="text-xs tabular-nums text-muted">
                    {fmtDate(s.currentPeriodStart)} → {fmtDate(s.currentPeriodEnd)}
                  </TD>
                  <TD className="text-xs tabular-nums text-muted">{fmtDate(s.trialEndsAt)}</TD>
                  <TD className="text-xs tabular-nums text-muted">{fmtDateTime(s.updatedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ projects */

async function ProjectsTab({ orgId }: { orgId: string }) {
  const projects = await db.project.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      createdAt: true,
      crawlRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true, pagesCrawled: true } },
      visibilityRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
      _count: { select: { prompts: true, actions: true } },
    },
  });
  const ids = projects.map((p) => p.id);
  const snaps = ids.length
    ? await db.reportSnapshot.findMany({
        where: { projectId: { in: ids }, kind: "crawl" },
        orderBy: { createdAt: "desc" },
        distinct: ["projectId"],
        select: { projectId: true, overallScore: true, grade: true, pillarScores: true, createdAt: true, simulated: true },
      })
    : [];
  const snapBy = new Map(snaps.map((s) => [s.projectId, s]));
  if (!projects.length) return <EmptyState bordered title="No projects yet" />;
  return (
    <Card>
      <Table caption="Projects" zebra density="compact">
        <THead>
          <tr>
            <TH>Project</TH>
            <TH>Latest score</TH>
            <TH>Pillars</TH>
            <TH>Last crawl</TH>
            <TH>Last AI check</TH>
            <TH align="right">Prompts</TH>
            <TH align="right">Actions</TH>
          </tr>
        </THead>
        <tbody>
          {projects.map((p) => {
            const s = snapBy.get(p.id);
            const pillars = (s?.pillarScores as Record<string, number | null> | null) ?? null;
            const crawl = p.crawlRuns[0];
            const vis = p.visibilityRuns[0];
            return (
              <TR key={p.id}>
                <TD>
                  <div className="font-medium text-fg">{p.name}</div>
                  <a href={p.websiteUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-primary hover:underline">
                    {p.websiteUrl}
                  </a>
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <ScoreRing score={s?.overallScore ?? null} size="sm" label={`${p.name} overall score`} />
                    {s && <span className="text-xs text-muted">{fmtDate(s.createdAt)}</span>}
                  </div>
                </TD>
                <TD className="text-xs text-muted">
                  {pillars
                    ? Object.entries(pillars)
                        .map(([k, v]) => `${k.toUpperCase()} ${v ?? "—"}`)
                        .join(" · ")
                    : "—"}
                </TD>
                <TD>
                  {crawl ? (
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge status={crawl.status} />
                      <span className="text-xs text-muted">
                        {fmtAgo(crawl.createdAt)} · {crawl.pagesCrawled} pages
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted">Never</span>
                  )}
                </TD>
                <TD>
                  {vis ? (
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge status={vis.status} />
                      <span className="text-xs text-muted">{fmtAgo(vis.createdAt)}</span>
                    </div>
                  ) : (
                    <span className="text-muted">Never</span>
                  )}
                </TD>
                <TD numeric>{p._count.prompts}</TD>
                <TD numeric>{p._count.actions}</TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

/* ------------------------------------------------------------------ members */

async function MembersTab({ orgId }: { orgId: string }) {
  const members = await db.membership.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, emailVerified: true, isStaff: true } },
    },
  });
  if (!members.length) return <EmptyState bordered title="No members" />;
  return (
    <Card>
      <Table caption="Members" zebra density="compact">
        <THead>
          <tr>
            <TH>User</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Email</TH>
            <TH>Joined</TH>
          </tr>
        </THead>
        <tbody>
          {members.map((m) => (
            <TR key={m.id}>
              <TD>
                <Link href={`/admin/users/${m.user.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                  {m.user.email}
                </Link>
                <div className="text-xs text-muted">
                  {m.user.name ?? "—"} {m.user.isStaff && <Badge tone="danger">staff</Badge>}
                </div>
              </TD>
              <TD className="capitalize">{m.role}</TD>
              <TD>
                <StatusPill status={m.status} />
              </TD>
              <TD>{m.user.emailVerified ? <Badge tone="success">verified</Badge> : <Badge tone="warning">unverified</Badge>}</TD>
              <TD className="text-xs tabular-nums text-muted">{fmtDate(m.createdAt)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* ------------------------------------------------------------------ usage & costs */

async function UsageTab({ orgId, sp }: { orgId: string; sp: SearchParams }) {
  const periodParam = str(sp, "period");
  const period = /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : billingPeriod();
  const [byTask, periods, daily] = await Promise.all([
    db.usageLedger.groupBy({
      by: ["taskType", "provider"],
      where: { organizationId: orgId, billingPeriod: period, kind: "actual" },
      _sum: { credits: true, costMicros: true },
      _count: { _all: true },
    }),
    db.usageLedger.groupBy({ by: ["billingPeriod"], where: { organizationId: orgId }, orderBy: { billingPeriod: "desc" }, take: 12 }),
    dailyCostByProvider(new Date(Date.now() - 30 * DAY_MS), orgId),
  ]);
  const rows = [...byTask].sort((a, b) => (b._sum.costMicros ?? 0) - (a._sum.costMicros ?? 0));
  const total = rows.reduce((a, r) => ({ credits: a.credits + (r._sum.credits ?? 0), micros: a.micros + (r._sum.costMicros ?? 0) }), { credits: 0, micros: 0 });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="AI cost per day (30 days)" description="Actual provider cost in USD" />
        <CardBody>
          <DailyStackedBars data={daily.data} keys={daily.providers} title="Organization AI cost per day" format="usd" height={200} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title={`Ledger · ${period}`}
          description="Actual usage by task type and provider."
          actions={
            <div className="flex flex-wrap gap-1">
              {periods.map((p) => (
                <Link
                  key={p.billingPeriod}
                  href={`/admin/customers/${orgId}?tab=usage&period=${p.billingPeriod}`}
                  className={p.billingPeriod === period ? "rounded-md bg-primary px-2 py-1 text-xs text-primary-fg" : "rounded-md bg-surface-2 px-2 py-1 text-xs text-fg-soft hover:text-fg"}
                >
                  {p.billingPeriod}
                </Link>
              ))}
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState size="sm" title="No usage in this period" />
        ) : (
          <Table caption="Usage by task type and provider" zebra density="compact">
            <THead>
              <tr>
                <TH>Task type</TH>
                <TH>Provider</TH>
                <TH align="right">Entries</TH>
                <TH align="right">Credits</TH>
                <TH align="right">Cost (USD)</TH>
                <TH align="right">Cost (INR)</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={`${r.taskType}-${r.provider}`}>
                  <TD className="font-medium text-fg">{r.taskType}</TD>
                  <TD>{r.provider}</TD>
                  <TD numeric>{r._count._all.toLocaleString()}</TD>
                  <TD numeric>{(r._sum.credits ?? 0).toLocaleString()}</TD>
                  <TD numeric>{formatUsd(microsToUsd(r._sum.costMicros ?? 0), 4)}</TD>
                  <TD numeric>{formatInr(microsToInr(r._sum.costMicros ?? 0))}</TD>
                </TR>
              ))}
              <TR className="font-semibold">
                <TD>Total</TD>
                <TD />
                <TD />
                <TD numeric>{total.credits.toLocaleString()}</TD>
                <TD numeric>{formatUsd(microsToUsd(total.micros), 4)}</TD>
                <TD numeric>{formatInr(microsToInr(total.micros))}</TD>
              </TR>
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ jobs */

async function JobsTab({ orgId, sp, base }: { orgId: string; sp: SearchParams; base: string }) {
  const { page, size, skip, take } = pageParams(sp, 25);
  const [runs, total] = await Promise.all([
    db.workflowRun.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: { id: true, kind: true, state: true, attempts: true, error: true, errorClass: true, createdAt: true, updatedAt: true },
    }),
    db.workflowRun.count({ where: { organizationId: orgId } }),
  ]);
  if (!total) return <EmptyState bordered title="No jobs yet" />;
  return (
    <Card>
      <Table caption="Jobs" zebra density="compact">
        <THead>
          <tr>
            <TH>Job</TH>
            <TH>State</TH>
            <TH>Error</TH>
            <TH align="right">Attempts</TH>
            <TH>Created</TH>
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
                <StatusBadge status={r.state} />
              </TD>
              <TD className="max-w-sm">
                <span className="line-clamp-2 text-xs text-fg-soft">{r.error ?? "—"}</span>
              </TD>
              <TD numeric>{r.attempts}</TD>
              <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(r.createdAt)}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
      <Pagination basePath={base} sp={{ ...sp, tab: "jobs" }} page={page} size={size} total={total} />
    </Card>
  );
}

/* ------------------------------------------------------------------ audit */

async function AuditTab({ orgId, sp, base }: { orgId: string; sp: SearchParams; base: string }) {
  const { page, size, skip, take } = pageParams(sp, 25);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, skip, take }),
    db.auditLog.count({ where: { organizationId: orgId } }),
  ]);
  const emails = await userEmails(rows.map((r) => r.actorId));
  if (!total) return <EmptyState bordered title="No audit events" />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 px-5 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 text-small">
              <Badge tone={r.actorType === "staff" ? "danger" : r.actorType === "system" ? "neutral" : "primary"}>{r.actorType}</Badge>
              <span className="font-mono text-xs font-semibold text-fg">{r.action}</span>
              <span className="text-muted">by {r.actorId ? (emails.get(r.actorId) ?? r.actorId) : "system"}</span>
              {r.resourceType && (
                <span className="text-xs text-muted">
                  · {r.resourceType} <Mono>{r.resourceId}</Mono>
                </span>
              )}
              <span className="ml-auto text-xs tabular-nums text-muted">{fmtDateTime(r.createdAt)}</span>
            </div>
            {(r.before != null || r.after != null) && (
              <div className="grid gap-2 md:grid-cols-2">
                <JsonView label="Before" value={r.before} maxHeight="14rem" />
                <JsonView label="After" value={r.after} maxHeight="14rem" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <Pagination basePath={base} sp={{ ...sp, tab: "audit" }} page={page} size={size} total={total} />
    </Card>
  );
}

/* ------------------------------------------------------------------ notes */

async function NotesTab({ orgId }: { orgId: string }) {
  const notes = await db.adminNote.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 100 });
  const emails = await userEmails(notes.map((n) => n.authorId));
  return (
    <Card>
      <CardHeader title="Internal notes" description="Visible to RankSignal staff only. Changes are audit-logged." />
      <CardBody>
        <NotesPanel
          orgId={orgId}
          notes={notes.map((n) => ({
            id: n.id,
            body: n.body,
            author: n.authorId ? (emails.get(n.authorId) ?? "Unknown") : "Unknown",
            createdAt: fmtDateTime(n.createdAt),
          }))}
        />
      </CardBody>
    </Card>
  );
}
