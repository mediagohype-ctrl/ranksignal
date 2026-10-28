// Customers (organizations): searchable, sortable, paginated.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { billingPeriod } from "@/lib/billing/usage";
import { requireStaffPage } from "@/lib/admin/guard";
import { orgActivity } from "@/lib/admin/metrics";
import { formatUsd, microsToUsd } from "@/lib/admin/money";
import { fmtAgo, fmtDate, oneOf, pageParams, str, type SearchParams } from "@/lib/admin/params";
import { Card, EmptyState, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, Mono, Pagination, PlanBadge, SortHeader, StatusPill, TierBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers" };

const SORTS = ["createdAt", "name", "planId", "status"] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp);
  const sort = oneOf(sp, "sort", SORTS, "createdAt");
  const dir = oneOf(sp, "dir", ["asc", "desc"] as const, sort === "name" ? "asc" : "desc");

  const where: Prisma.OrganizationWhereInput = {};
  const q = str(sp, "q").slice(0, 120);
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { id: q },
      { name: c },
      { memberships: { some: { user: { email: c } } } },
      { projects: { some: { OR: [{ websiteUrl: c }, { name: c }] } } },
    ];
  }
  const plan = str(sp, "plan");
  if (plan) where.planId = plan;
  const tier = str(sp, "tier");
  if (tier === "none") where.serviceTier = null;
  else if (tier) where.serviceTier = tier;
  const status = str(sp, "status");
  if (status) where.status = status;

  const period = billingPeriod();
  const [rows, total] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: [{ [sort]: dir }, { id: "asc" }],
      skip,
      take,
      select: {
        id: true,
        name: true,
        planId: true,
        serviceTier: true,
        status: true,
        publishingEnabled: true,
        createdAt: true,
        _count: { select: { memberships: { where: { status: "active" } }, projects: true } },
      },
    }),
    db.organization.count({ where }),
  ]);
  const activity = await orgActivity(
    rows.map((r) => r.id),
    period,
  );

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every organization: plan, service tier, status, size and spend this month."
        meta={<span className="tabular-nums">{total.toLocaleString()} matching</span>}
      />
      <Card>
        <FilterBar action="/admin/customers" resetHref="/admin/customers">
          <FilterInput name="q" label="Search" defaultValue={q} placeholder="Name, member email, domain or id" type="search" />
          <FilterSelect name="plan" label="Plan" defaultValue={plan} options={["trial", "starter", "growth", "agency"]} />
          <FilterSelect
            name="tier"
            label="Service tier"
            defaultValue={tier}
            options={[{ value: "none", label: "Self-serve only" }, "fix", "grow", "authority"]}
          />
          <FilterSelect name="status" label="Status" defaultValue={status} options={["active", "past_due", "cancelled", "suspended"]} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<Building2 />} title="No customers match" description="Try a different search or clear the filters." />
        ) : (
          <Table caption="Customers" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>
                  <SortHeader label="Organization" field="name" sort={sort} dir={dir} basePath="/admin/customers" sp={sp} />
                </TH>
                <TH>
                  <SortHeader label="Plan" field="planId" sort={sort} dir={dir} basePath="/admin/customers" sp={sp} />
                </TH>
                <TH>Service</TH>
                <TH>
                  <SortHeader label="Status" field="status" sort={sort} dir={dir} basePath="/admin/customers" sp={sp} />
                </TH>
                <TH>
                  <SortHeader label="Created" field="createdAt" sort={sort} dir={dir} basePath="/admin/customers" sp={sp} />
                </TH>
                <TH align="right">Members</TH>
                <TH align="right">Projects</TH>
                <TH>Last activity</TH>
                <TH align="right">Credits ({period})</TH>
                <TH align="right">AI cost</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((o) => {
                const a = activity.get(o.id);
                return (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/admin/customers/${o.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                        {o.name}
                      </Link>
                      <div>
                        <Mono>{o.id}</Mono>
                        {!o.publishingEnabled && <span className="ml-2 text-xs font-medium text-warning">publishing paused</span>}
                      </div>
                    </TD>
                    <TD>
                      <PlanBadge planId={o.planId} />
                    </TD>
                    <TD>
                      <TierBadge tier={o.serviceTier} />
                    </TD>
                    <TD>
                      <StatusPill status={o.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmtDate(o.createdAt)}</TD>
                    <TD numeric>{o._count.memberships}</TD>
                    <TD numeric>{o._count.projects}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted">{fmtAgo(a?.lastActivity ?? null)}</TD>
                    <TD numeric>{(a?.credits ?? 0).toLocaleString()}</TD>
                    <TD numeric>{formatUsd(microsToUsd(a?.costMicros ?? 0))}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/customers" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
