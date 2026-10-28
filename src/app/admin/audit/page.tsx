// Audit log explorer: filter by organization, actor (id or email), action prefix, actor type and date.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { orgNames, userEmails } from "@/lib/admin/metrics";
import { dateRangeWhere, fmtDateTime, pageParams, str, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, JsonView, Mono, Pagination } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp, 50);
  const where: Prisma.AuditLogWhereInput = {};
  const org = str(sp, "org");
  if (org) where.organizationId = org;
  const actor = str(sp, "actor");
  let actorNotFound = false;
  if (actor) {
    if (actor.includes("@")) {
      const u = await db.user.findUnique({ where: { email: actor.toLowerCase() }, select: { id: true } });
      if (u) where.actorId = u.id;
      else actorNotFound = true;
    } else where.actorId = actor;
  }
  const action = str(sp, "action");
  if (action) where.action = { startsWith: action };
  const actorType = str(sp, "actorType");
  if (actorType) where.actorType = actorType;
  const created = dateRangeWhere(sp);
  if (created) where.createdAt = created;

  const [rows, total] = actorNotFound
    ? [[], 0]
    : await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), db.auditLog.count({ where })]);
  const [emails, names] = await Promise.all([userEmails(rows.map((r) => r.actorId)), orgNames(rows.map((r) => r.organizationId))]);

  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="Audit log" description="Append-only record of sign-ins, approvals, publishing, billing and every staff action." />
      <Card>
        <FilterBar action="/admin/audit" resetHref="/admin/audit">
          <FilterInput name="org" label="Organization id" defaultValue={org} placeholder="cl…" />
          <FilterInput name="actor" label="Actor (id or email)" defaultValue={actor} placeholder="name@company.com" />
          <FilterInput name="action" label="Action prefix" defaultValue={action} placeholder="admin. / auth. / billing." />
          <FilterSelect name="actorType" label="Actor type" defaultValue={actorType} options={["user", "staff", "system"]} />
          <FilterInput name="from" label="From" type="date" defaultValue={str(sp, "from")} />
          <FilterInput name="to" label="To" type="date" defaultValue={str(sp, "to")} />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title={actorNotFound ? "No user with that email" : "No audit events match"} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 px-5 py-3 sm:px-6">
                <div className="flex flex-wrap items-center gap-2 text-small">
                  <Badge tone={r.actorType === "staff" ? "danger" : r.actorType === "system" ? "neutral" : "primary"}>{r.actorType}</Badge>
                  <Link href={`/admin/audit?action=${encodeURIComponent(r.action)}`} className="font-mono text-xs font-semibold text-fg hover:underline">
                    {r.action}
                  </Link>
                  <span className="text-muted">
                    by{" "}
                    {r.actorId ? (
                      <Link href={`/admin/users/${r.actorId}`} className="text-fg-soft hover:text-primary hover:underline">
                        {emails.get(r.actorId) ?? r.actorId}
                      </Link>
                    ) : (
                      "system"
                    )}
                  </span>
                  {r.organizationId && (
                    <span className="text-muted">
                      in{" "}
                      <Link href={`/admin/customers/${r.organizationId}`} className="text-fg-soft hover:text-primary hover:underline">
                        {names.get(r.organizationId) ?? r.organizationId}
                      </Link>
                    </span>
                  )}
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
        )}
        <Pagination basePath="/admin/audit" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
