// Admin overview: KPIs with period comparison, trend charts and a "needs attention" list.
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  Bot,
  Building2,
  Clock,
  CreditCard,
  FileText,
  Hourglass,
  IndianRupee,
  Layers,
  ScanSearch,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import { billingPeriod } from "@/lib/billing/usage";
import { getAiDailyBudgetUsd } from "@/lib/billing/ai-budget";
import { requireStaffPage } from "@/lib/admin/guard";
import { estimateMrr, formatInr, formatUsd, microsToInr, microsToUsd, SERVICE_TIERS } from "@/lib/admin/money";
import { bucketTrials, dailyCostByProvider, dailyCounts, loadTrialOrgs, orgNames, seriesFromMap } from "@/lib/admin/metrics";
import { DAY_MS, fmtAgo, fmtDate, pctDelta, rangeParam, utcDayStart, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, EmptyState, Meter, PageHeader, Stat, type Tone } from "@/components/ui";
import { DailyArea, DailyStackedBars } from "@/components/admin/charts";
import { EstimatedTag, RangePicker } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const sumMicros = (a: { _sum: { costMicros: number | null } }) => a._sum.costMicros ?? 0;

export default async function AdminOverview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const r = rangeParam(sp);
  const cur = { gte: r.since, lt: r.now };
  const prev = { gte: r.prevSince, lt: r.since };
  const today = utcDayStart();
  const period = billingPeriod();
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

  const [
    signupsCur,
    signupsPrev,
    runOrgsCur,
    runOrgsPrev,
    auditOrgsCur,
    auditOrgsPrev,
    orgGroups,
    trials,
    churnCur,
    churnPrev,
    aiToday,
    aiMonth,
    aiCur,
    aiPrev,
    crawlCur,
    crawlPrev,
    visCur,
    visPrev,
    failedCur,
    failedPrev,
    signupsDaily,
    crawlDaily,
    visDaily,
    costDaily,
    failedByOrg,
    pastDue,
    drafts,
  ] = await Promise.all([
    db.user.count({ where: { createdAt: cur } }),
    db.user.count({ where: { createdAt: prev } }),
    db.workflowRun.groupBy({ by: ["organizationId"], where: { createdAt: cur } }),
    db.workflowRun.groupBy({ by: ["organizationId"], where: { createdAt: prev } }),
    db.auditLog.groupBy({ by: ["organizationId"], where: { createdAt: cur, actorType: "user", organizationId: { not: null } } }),
    db.auditLog.groupBy({ by: ["organizationId"], where: { createdAt: prev, actorType: "user", organizationId: { not: null } } }),
    db.organization.groupBy({ by: ["planId", "status", "serviceTier"], _count: { _all: true } }),
    loadTrialOrgs(),
    db.subscription.count({ where: { status: { in: ["cancelled", "expired"] }, updatedAt: cur } }),
    db.subscription.count({ where: { status: { in: ["cancelled", "expired"] }, updatedAt: prev } }),
    db.usageLedger.aggregate({ where: { kind: "actual", createdAt: { gte: today } }, _sum: { costMicros: true } }),
    db.usageLedger.aggregate({ where: { kind: "actual", billingPeriod: period }, _sum: { costMicros: true } }),
    db.usageLedger.aggregate({ where: { kind: "actual", createdAt: cur }, _sum: { costMicros: true } }),
    db.usageLedger.aggregate({ where: { kind: "actual", createdAt: prev }, _sum: { costMicros: true } }),
    db.crawlRun.count({ where: { createdAt: cur } }),
    db.crawlRun.count({ where: { createdAt: prev } }),
    db.visibilityRun.count({ where: { createdAt: cur } }),
    db.visibilityRun.count({ where: { createdAt: prev } }),
    db.workflowRun.count({ where: { state: "failed", updatedAt: cur } }),
    db.workflowRun.count({ where: { state: "failed", updatedAt: prev } }),
    dailyCounts("User", r.since),
    dailyCounts("CrawlRun", r.since),
    dailyCounts("VisibilityRun", r.since),
    dailyCostByProvider(r.since),
    db.workflowRun.groupBy({
      by: ["organizationId"],
      where: { state: { in: ["failed", "rollback_failed"] }, updatedAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { organizationId: "desc" } },
      take: 10,
    }),
    db.organization.findMany({ where: { status: "past_due" }, select: { id: true, name: true }, take: 10 }),
    db.monthlyReport.groupBy({ by: ["organizationId"], where: { status: "draft" }, _count: { _all: true }, orderBy: { organizationId: "asc" }, take: 10 }),
  ]);

  const active = (a: { organizationId: string | null }[], b: { organizationId: string | null }[]) =>
    new Set([...a, ...b].map((x) => x.organizationId).filter(Boolean)).size;
  const activeCur = active(runOrgsCur, auditOrgsCur);
  const activePrev = active(runOrgsPrev, auditOrgsPrev);

  const groups = orgGroups.map((g) => ({ planId: g.planId, status: g.status, serviceTier: g.serviceTier, count: g._count._all }));
  const mrr = estimateMrr(groups);
  const billed = groups.filter((g) => g.status === "active" || g.status === "past_due");
  const payingByPlan = new Map<string, number>();
  for (const g of billed) if (g.planId !== "trial") payingByPlan.set(g.planId, (payingByPlan.get(g.planId) ?? 0) + g.count);
  const paying = [...payingByPlan.values()].reduce((a, n) => a + n, 0);
  const tierCounts = new Map<string, number>();
  for (const g of billed) if (g.serviceTier) tierCounts.set(g.serviceTier, (tierCounts.get(g.serviceTier) ?? 0) + g.count);
  const serviceClients = [...tierCounts.values()].reduce((a, n) => a + n, 0);
  const cancelledNow = groups.filter((g) => g.status === "cancelled").reduce((a, g) => a + g.count, 0);
  const t = bucketTrials(trials);

  const budgetUsd = getAiDailyBudgetUsd();
  const todayUsd = microsToUsd(sumMicros(aiToday));
  const monthMicros = sumMicros(aiMonth);

  // Needs attention
  const names = await orgNames([...failedByOrg.map((f) => f.organizationId), ...drafts.map((d) => d.organizationId)]);
  const attention: { key: string; orgId: string; name: string; label: string; tone: Tone; icon: React.ReactNode; href: string }[] = [
    ...failedByOrg.map((f) => ({
      key: `f-${f.organizationId}`,
      orgId: f.organizationId,
      name: names.get(f.organizationId) ?? f.organizationId,
      label: `${f._count._all} failed job${f._count._all === 1 ? "" : "s"} (7d)`,
      tone: "danger" as Tone,
      icon: <AlertOctagon />,
      href: `/admin/jobs?org=${f.organizationId}&state=failed`,
    })),
    ...pastDue.map((o) => ({
      key: `p-${o.id}`,
      orgId: o.id,
      name: o.name,
      label: "Payment past due",
      tone: "warning" as Tone,
      icon: <CreditCard />,
      href: `/admin/customers/${o.id}`,
    })),
    ...t.expiringSoon.slice(0, 10).map((o) => ({
      key: `t-${o.id}`,
      orgId: o.id,
      name: o.name,
      label: `Trial ends ${fmtAgo(o.trialEndsAt)}`,
      tone: "info" as Tone,
      icon: <Hourglass />,
      href: `/admin/customers/${o.id}`,
    })),
    ...drafts.map((d) => ({
      key: `d-${d.organizationId}`,
      orgId: d.organizationId,
      name: names.get(d.organizationId) ?? d.organizationId,
      label: `${d._count._all} monthly report draft${d._count._all === 1 ? "" : "s"} to review`,
      tone: "accent" as Tone,
      icon: <FileText />,
      href: "/admin/monthly-reports?status=draft",
    })),
  ];

  const deltaLabel = `vs previous ${r.days}d`;
  const signupSeries = seriesFromMap({ key: "Signups", map: signupsDaily });
  const scanSeries = seriesFromMap({ key: "Crawls", map: crawlDaily }, { key: "AI checks", map: visDaily });

  return (
    <div className="space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="RankSignal back-office"
        title="Overview"
        description={`Business and platform health for the last ${r.days} days, compared with the ${r.days} days before.`}
        actions={<RangePicker basePath="/admin" sp={sp} active={r.key} />}
      />

      <section aria-labelledby="kpi-growth" className="space-y-4">
        <h2 id="kpi-growth" className="text-caption uppercase tracking-[0.06em] text-muted">
          Customers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Signups" value={signupsCur.toLocaleString()} delta={pctDelta(signupsCur, signupsPrev)} deltaLabel={deltaLabel} icon={<UserPlus />} />
          <Stat label="Active orgs" value={activeCur.toLocaleString()} delta={pctDelta(activeCur, activePrev)} deltaLabel={deltaLabel} icon={<Building2 />} hint="Ran a job or used the app" />
          <Stat
            label="Trials"
            value={t.active.length.toLocaleString()}
            icon={<Clock />}
            hint={
              <span>
                <Link href="/admin/customers?plan=trial" className="text-warning hover:underline">
                  {t.expiringSoon.length} expiring in 7d
                </Link>{" "}
                · {t.expired.length} expired
              </span>
            }
          />
          <Stat
            label="Cancelled / churned"
            value={churnCur.toLocaleString()}
            delta={pctDelta(churnCur, churnPrev)}
            invertDelta
            deltaLabel={deltaLabel}
            icon={<UserMinus />}
            hint={`${cancelledNow} orgs currently cancelled`}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Paying orgs"
            value={paying.toLocaleString()}
            icon={<CreditCard />}
            hint={[...payingByPlan.entries()].map(([p, n]) => `${p} ${n}`).join(" · ") || "None yet"}
          />
          <Stat
            label="Service clients"
            value={serviceClients.toLocaleString()}
            icon={<Layers />}
            hint={SERVICE_TIERS.map((tier) => `${tier} ${tierCounts.get(tier) ?? 0}`).join(" · ")}
          />
          <Stat
            label={
              <span className="inline-flex items-center gap-1.5">
                MRR <EstimatedTag />
              </span>
            }
            value={formatInr(mrr.totalInr)}
            icon={<IndianRupee />}
            hint={`Plans ${formatInr(mrr.planInr, { compact: true })} · Service ${formatInr(mrr.serviceInr, { compact: true })}`}
            footer={
              <Link href="/admin/revenue" className="text-xs font-medium text-primary hover:underline">
                Breakdown →
              </Link>
            }
          />
          <Stat
            label="Scans run"
            value={(crawlCur + visCur).toLocaleString()}
            delta={pctDelta(crawlCur + visCur, crawlPrev + visPrev)}
            deltaLabel={deltaLabel}
            icon={<ScanSearch />}
            hint={`${crawlCur} crawls · ${visCur} AI checks`}
          />
        </div>
      </section>

      <section aria-labelledby="kpi-platform" className="space-y-4">
        <h2 id="kpi-platform" className="text-caption uppercase tracking-[0.06em] text-muted">
          Platform & cost
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="AI spend today (UTC)"
            value={formatUsd(todayUsd)}
            icon={<Bot />}
            footer={<Meter value={todayUsd} max={Math.max(budgetUsd, 0.0001)} label={`Daily budget ${formatUsd(budgetUsd)}`} size="xs" showValue />}
          />
          <Stat
            label={`AI spend · ${period}`}
            value={formatUsd(microsToUsd(monthMicros))}
            icon={<Bot />}
            hint={`≈ ${formatInr(microsToInr(monthMicros))}`}
          />
          <Stat
            label={`AI spend · ${r.days}d`}
            value={formatUsd(microsToUsd(sumMicros(aiCur)))}
            delta={pctDelta(sumMicros(aiCur), sumMicros(aiPrev))}
            invertDelta
            deltaLabel={deltaLabel}
            icon={<Bot />}
          />
          <Stat
            label="Failed jobs"
            value={failedCur.toLocaleString()}
            delta={pctDelta(failedCur, failedPrev)}
            invertDelta
            deltaLabel={deltaLabel}
            icon={<Activity />}
            footer={
              <Link href="/admin/jobs?state=failed" className="text-xs font-medium text-primary hover:underline">
                View failed jobs →
              </Link>
            }
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Signups per day" description={`Since ${fmtDate(r.since)}`} />
          <CardBody>
            <DailyArea data={signupSeries} keys={["Signups"]} title="Signups per day" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="AI cost per day" description="Actual provider cost (USD), by provider" />
          <CardBody>
            <DailyStackedBars data={costDaily.data} keys={costDaily.providers} title="AI cost per day by provider" format="usd" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Scans per day" description="Crawls and AI visibility checks started" />
          <CardBody>
            <DailyArea data={scanSeries} keys={["Crawls", "AI checks"]} title="Scans per day" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Needs attention"
          description="Failed jobs (7 days), payments past due, trials ending within 7 days and monthly reports awaiting review."
          actions={<Badge tone={attention.length ? "warning" : "success"}>{attention.length} items</Badge>}
        />
        {attention.length === 0 ? (
          <EmptyState size="sm" title="All clear" description="Nothing needs a human right now." />
        ) : (
          <ul className="divide-y divide-border">
            {attention.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge tone={a.tone} icon={a.icon}>
                    {a.label}
                  </Badge>
                  <Link href={`/admin/customers/${a.orgId}`} className="truncate text-small font-medium text-fg hover:underline">
                    {a.name}
                  </Link>
                </div>
                <Link href={a.href} className="text-small font-medium text-primary hover:underline">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
