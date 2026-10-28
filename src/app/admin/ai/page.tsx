// AI usage & costs: spend by day, provider, task type, model and organization; daily budget status.
import Link from "next/link";
import { Bot, Gauge, IndianRupee, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getAiDailyBudgetUsd } from "@/lib/billing/ai-budget";
import { requireStaffPage } from "@/lib/admin/guard";
import { dailyCostByProvider, orgNames } from "@/lib/admin/metrics";
import { formatInr, formatUsd, microsToInr, microsToUsd, usdInrRate } from "@/lib/admin/money";
import { pctDelta, rangeParam, utcDayStart, type SearchParams } from "@/lib/admin/params";
import { Card, CardBody, CardHeader, EmptyState, Meter, Notice, PageHeader, Stat, Table, TD, TH, THead, TR } from "@/components/ui";
import { DailyStackedBars } from "@/components/admin/charts";
import { RangePicker } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI usage & costs" };

type Row = { key: string; micros: number; credits?: number; count: number };

function CostTable({ title, description, rows, totalMicros, label }: { title: string; description?: string; rows: Row[]; totalMicros: number; label: string }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <EmptyState size="sm" title="No spend in this period" />
      ) : (
        <Table caption={title} density="compact" zebra>
          <THead>
            <tr>
              <TH>{label}</TH>
              <TH align="right">Calls</TH>
              <TH align="right">USD</TH>
              <TH align="right">INR</TH>
              <TH align="right">Share</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.key}>
                <TD className="font-medium text-fg">{r.key}</TD>
                <TD numeric>{r.count.toLocaleString()}</TD>
                <TD numeric>{formatUsd(microsToUsd(r.micros), 3)}</TD>
                <TD numeric>{formatInr(microsToInr(r.micros))}</TD>
                <TD numeric>{totalMicros ? `${Math.round((r.micros / totalMicros) * 100)}%` : "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default async function AiCostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const r = rangeParam(sp);
  const cur = { gte: r.since, lt: r.now };
  const ledger = { kind: "actual", createdAt: cur };
  const [today, totalCur, totalPrev, daily, byProvider, byTask, byModel, topOrgs] = await Promise.all([
    db.usageLedger.aggregate({ where: { kind: "actual", createdAt: { gte: utcDayStart() } }, _sum: { costMicros: true } }),
    db.usageLedger.aggregate({ where: ledger, _sum: { costMicros: true, credits: true } }),
    db.usageLedger.aggregate({ where: { kind: "actual", createdAt: { gte: r.prevSince, lt: r.since } }, _sum: { costMicros: true } }),
    dailyCostByProvider(r.since),
    db.usageLedger.groupBy({ by: ["provider"], where: ledger, _sum: { costMicros: true, credits: true }, _count: { _all: true } }),
    db.usageLedger.groupBy({ by: ["taskType"], where: ledger, _sum: { costMicros: true, credits: true }, _count: { _all: true } }),
    db.observation.groupBy({ by: ["provider", "model"], where: { createdAt: cur }, _sum: { costMicros: true }, _count: { _all: true } }),
    db.usageLedger.groupBy({
      by: ["organizationId"],
      where: ledger,
      _sum: { costMicros: true, credits: true },
      _count: { _all: true },
      orderBy: { _sum: { costMicros: "desc" } },
      take: 10,
    }),
  ]);
  const names = await orgNames(topOrgs.map((o) => o.organizationId));
  const budget = getAiDailyBudgetUsd();
  const todayUsd = microsToUsd(today._sum.costMicros ?? 0);
  const totalMicros = totalCur._sum.costMicros ?? 0;
  const prevMicros = totalPrev._sum.costMicros ?? 0;
  const sortRows = (rows: Row[]) => rows.sort((a, b) => b.micros - a.micros);
  const rate = usdInrRate();

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="AI usage & costs"
        description={`Actual provider cost from the usage ledger (micro-USD), converted at ₹${rate}/USD (ADMIN_USD_INR_RATE).`}
        actions={<RangePicker basePath="/admin/ai" sp={sp} active={r.key} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today (UTC)"
          value={formatUsd(todayUsd)}
          icon={<Gauge />}
          footer={<Meter value={todayUsd} max={Math.max(budget, 0.0001)} label={`Budget ${formatUsd(budget)} / day`} size="xs" showValue />}
        />
        <Stat
          label={`Spend · ${r.days}d`}
          value={formatUsd(microsToUsd(totalMicros))}
          delta={pctDelta(totalMicros, prevMicros)}
          invertDelta
          deltaLabel={`vs previous ${r.days}d`}
          icon={<Wallet />}
        />
        <Stat label={`Spend · ${r.days}d (INR)`} value={formatInr(microsToInr(totalMicros))} icon={<IndianRupee />} />
        <Stat
          label="Avg per day"
          value={formatUsd(microsToUsd(totalMicros) / r.days)}
          icon={<Bot />}
          hint={`${(totalCur._sum.credits ?? 0).toLocaleString()} credits used`}
        />
      </div>
      {todayUsd >= budget && (
        <Notice tone="danger" title="Daily AI budget reached">
          New AI calls are paused until 00:00 UTC. Raise AI_DAILY_BUDGET_USD if this is expected.
        </Notice>
      )}
      <Card>
        <CardHeader title="Spend per day by provider" description="USD" />
        <CardBody>
          <DailyStackedBars data={daily.data} keys={daily.providers} title="AI spend per day by provider" format="usd" height={280} />
        </CardBody>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <CostTable
          title="By provider"
          label="Provider"
          totalMicros={totalMicros}
          rows={sortRows(byProvider.map((g) => ({ key: g.provider, micros: g._sum.costMicros ?? 0, credits: g._sum.credits ?? 0, count: g._count._all })))}
        />
        <CostTable
          title="By task type"
          label="Task type"
          totalMicros={totalMicros}
          rows={sortRows(byTask.map((g) => ({ key: g.taskType, micros: g._sum.costMicros ?? 0, credits: g._sum.credits ?? 0, count: g._count._all })))}
        />
        <CostTable
          title="By model (AI answers)"
          description="From individual AI answers (observations); excludes analysis and content-generation calls."
          label="Provider · model"
          totalMicros={byModel.reduce((a, g) => a + (g._sum.costMicros ?? 0), 0)}
          rows={sortRows(byModel.map((g) => ({ key: `${g.provider} · ${g.model ?? "unknown"}`, micros: g._sum.costMicros ?? 0, count: g._count._all })))}
        />
        <Card>
          <CardHeader title="Top 10 costliest organizations" description={`Last ${r.days} days`} />
          {topOrgs.length === 0 ? (
            <EmptyState size="sm" title="No spend in this period" />
          ) : (
            <Table caption="Top 10 costliest organizations" density="compact" zebra>
              <THead>
                <tr>
                  <TH>Organization</TH>
                  <TH align="right">Credits</TH>
                  <TH align="right">USD</TH>
                  <TH align="right">INR</TH>
                </tr>
              </THead>
              <tbody>
                {topOrgs.map((o) => (
                  <TR key={o.organizationId}>
                    <TD>
                      <Link href={`/admin/customers/${o.organizationId}?tab=usage`} className="font-medium text-fg hover:text-primary hover:underline">
                        {names.get(o.organizationId) ?? o.organizationId}
                      </Link>
                    </TD>
                    <TD numeric>{(o._sum.credits ?? 0).toLocaleString()}</TD>
                    <TD numeric>{formatUsd(microsToUsd(o._sum.costMicros ?? 0), 3)}</TD>
                    <TD numeric>{formatInr(microsToInr(o._sum.costMicros ?? 0))}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
