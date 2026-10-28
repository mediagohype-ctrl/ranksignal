// Revenue & plans: estimated MRR breakdown, plan mix, service tiers, subscriptions and recent billing webhooks.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { IndianRupee } from "lucide-react";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/billing/plans";
import { requireStaffPage } from "@/lib/admin/guard";
import { estimateMrr, formatInr, SERVICE_TIER_PRICES_INR, SERVICE_TIERS } from "@/lib/admin/money";
import { orgNames } from "@/lib/admin/metrics";
import { fmtDate, fmtDateTime, pageParams, str, type SearchParams } from "@/lib/admin/params";
import { Card, CardBody, CardHeader, EmptyState, Meter, Notice, PageHeader, Stat, Table, TD, TH, THead, TR } from "@/components/ui";
import { EstimatedTag, FilterBar, FilterSelect, Mono, Pagination, PlanBadge, StatusPill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue & plans" };

export default async function RevenuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp, 25);
  const subWhere: Prisma.SubscriptionWhereInput = {};
  const status = str(sp, "status");
  if (status) subWhere.status = status;
  const plan = str(sp, "plan");
  if (plan) subWhere.planId = plan;

  const [groups, subs, subTotal, subStatus, webhooks] = await Promise.all([
    db.organization.groupBy({ by: ["planId", "status", "serviceTier"], _count: { _all: true } }),
    db.subscription.findMany({ where: subWhere, orderBy: { updatedAt: "desc" }, skip, take }),
    db.subscription.count({ where: subWhere }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    db.webhookEvent.findMany({ orderBy: { processedAt: "desc" }, take: 10, select: { id: true, provider: true, type: true, eventId: true, processedAt: true } }),
  ]);
  const names = await orgNames(subs.map((s) => s.organizationId));
  const rows = groups.map((g) => ({ planId: g.planId, status: g.status, serviceTier: g.serviceTier, count: g._count._all }));
  const mrr = estimateMrr(rows);

  const planMix = new Map<string, { total: number; billed: number }>();
  const tierMix = new Map<string, { total: number; billed: number }>();
  for (const r of rows) {
    const billed = r.status === "active" || r.status === "past_due";
    const p = planMix.get(r.planId) ?? { total: 0, billed: 0 };
    p.total += r.count;
    if (billed) p.billed += r.count;
    planMix.set(r.planId, p);
    if (r.serviceTier) {
      const t = tierMix.get(r.serviceTier) ?? { total: 0, billed: 0 };
      t.total += r.count;
      if (billed) t.billed += r.count;
      tierMix.set(r.serviceTier, t);
    }
  }
  const totalOrgs = rows.reduce((a, r) => a + r.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="Revenue & plans" description="Estimated recurring revenue from list prices, plan mix and the subscription ledger." />
      <Notice tone="neutral" title="About these numbers">
        MRR is an <strong>estimate</strong>: list price × organizations whose status is active or past due. It ignores discounts, GST,
        setup fees, annual billing and proration. Razorpay is the source of truth for money actually collected.
      </Notice>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={<span className="inline-flex items-center gap-1.5">Total MRR <EstimatedTag /></span>} value={formatInr(mrr.totalInr)} icon={<IndianRupee />} hint={`ARR ≈ ${formatInr(mrr.totalInr * 12, { compact: true })}`} />
        <Stat label="Self-serve plans" value={formatInr(mrr.planInr)} hint={`${mrr.totalInr ? Math.round((mrr.planInr / mrr.totalInr) * 100) : 0}% of MRR`} />
        <Stat label="Done-for-you services" value={formatInr(mrr.serviceInr)} hint={`${mrr.totalInr ? Math.round((mrr.serviceInr / mrr.totalInr) * 100) : 0}% of MRR`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="MRR breakdown" description="Billed organizations × monthly list price" />
          {mrr.lines.length === 0 ? (
            <EmptyState size="sm" title="No paying customers yet" />
          ) : (
            <Table caption="MRR breakdown" density="compact">
              <THead>
                <tr>
                  <TH>Line</TH>
                  <TH align="right">Orgs</TH>
                  <TH align="right">Price</TH>
                  <TH align="right">MRR</TH>
                </tr>
              </THead>
              <tbody>
                {mrr.lines.map((l) => (
                  <TR key={`${l.kind}-${l.id}`}>
                    <TD className="font-medium text-fg">{l.label}</TD>
                    <TD numeric>{l.count}</TD>
                    <TD numeric>{formatInr(l.unitInr)}</TD>
                    <TD numeric>{formatInr(l.totalInr)}</TD>
                  </TR>
                ))}
                <TR className="font-semibold">
                  <TD>Total</TD>
                  <TD />
                  <TD />
                  <TD numeric>{formatInr(mrr.totalInr)}</TD>
                </TR>
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Plan mix" description={`${totalOrgs.toLocaleString()} organizations`} />
          <CardBody className="space-y-4">
            {Object.values(PLANS).map((p) => {
              const m = planMix.get(p.id) ?? { total: 0, billed: 0 };
              return (
                <div key={p.id}>
                  <Meter value={m.total} max={Math.max(totalOrgs, 1)} tone="primary" label={`${p.name} · ${m.total} (${m.billed} billed)`} showValue size="sm" />
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Service tiers" description="Done-for-you clients (setup fees not included)" />
          <Table caption="Service tiers" density="compact">
            <THead>
              <tr>
                <TH>Tier</TH>
                <TH align="right">Price / mo</TH>
                <TH align="right">Clients</TH>
                <TH align="right">Billed</TH>
              </tr>
            </THead>
            <tbody>
              {SERVICE_TIERS.map((t) => (
                <TR key={t}>
                  <TD className="font-medium capitalize text-fg">
                    <Link href={`/admin/customers?tier=${t}`} className="hover:underline">
                      {t}
                    </Link>
                  </TD>
                  <TD numeric>{formatInr(SERVICE_TIER_PRICES_INR[t])}</TD>
                  <TD numeric>{tierMix.get(t)?.total ?? 0}</TD>
                  <TD numeric>{tierMix.get(t)?.billed ?? 0}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Subscriptions"
          description={subStatus.map((s) => `${s.status} ${s._count._all}`).join(" · ") || "No subscriptions yet"}
        />
        <FilterBar action="/admin/revenue" resetHref="/admin/revenue">
          <FilterSelect name="status" label="Status" defaultValue={status} options={["trialing", "active", "past_due", "cancelled", "expired"]} />
          <FilterSelect name="plan" label="Plan" defaultValue={plan} options={["trial", "starter", "growth", "agency"]} />
        </FilterBar>
        {subs.length === 0 ? (
          <EmptyState size="sm" title="No subscriptions match" />
        ) : (
          <Table caption="Subscriptions" zebra density="compact">
            <THead>
              <tr>
                <TH>Organization</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>Provider</TH>
                <TH>Period end</TH>
                <TH>Trial end</TH>
                <TH>Updated</TH>
              </tr>
            </THead>
            <tbody>
              {subs.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/admin/customers/${s.organizationId}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {names.get(s.organizationId) ?? s.organizationId}
                    </Link>
                  </TD>
                  <TD>
                    <PlanBadge planId={s.planId} />
                  </TD>
                  <TD>
                    <StatusPill status={s.status} />
                  </TD>
                  <TD>
                    {s.provider}
                    {s.providerSubscriptionId && (
                      <div>
                        <Mono>{s.providerSubscriptionId}</Mono>
                      </div>
                    )}
                  </TD>
                  <TD className="text-xs tabular-nums text-muted">{fmtDate(s.currentPeriodEnd)}</TD>
                  <TD className="text-xs tabular-nums text-muted">{fmtDate(s.trialEndsAt)}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(s.updatedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/revenue" sp={sp} page={page} size={size} total={subTotal} />
      </Card>

      <Card>
        <CardHeader title="Recent webhook events" actions={<Link href="/admin/webhooks" className="text-small font-medium text-primary hover:underline">All webhooks →</Link>} />
        {webhooks.length === 0 ? (
          <EmptyState size="sm" title="No webhook events yet" />
        ) : (
          <Table caption="Recent webhook events" density="compact" zebra>
            <THead>
              <tr>
                <TH>Type</TH>
                <TH>Provider</TH>
                <TH>Event id</TH>
                <TH>Processed</TH>
              </tr>
            </THead>
            <tbody>
              {webhooks.map((w) => (
                <TR key={w.id}>
                  <TD>
                    <Link href={`/admin/webhooks?id=${w.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {w.type}
                    </Link>
                  </TD>
                  <TD>{w.provider}</TD>
                  <TD>
                    <Mono>{w.eventId.slice(0, 32)}</Mono>
                  </TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(w.processedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
