// Users: search by email/name/id, filter staff / unverified, last sign-in from the audit log.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { fmtAgo, fmtDate, pageParams, str, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, EmptyState, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, Mono, Pagination } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp);
  const where: Prisma.UserWhereInput = {};
  const q = str(sp, "q").slice(0, 120);
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    where.OR = [{ id: q }, { email: c }, { name: c }];
  }
  const kind = str(sp, "kind");
  if (kind === "staff") where.isStaff = true;
  if (kind === "unverified") where.emailVerified = false;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        isStaff: true,
        emailVerified: true,
        createdAt: true,
        memberships: {
          where: { status: "active" },
          take: 3,
          orderBy: { createdAt: "asc" },
          select: { role: true, organization: { select: { id: true, name: true } } },
        },
        _count: { select: { memberships: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  const ids = users.map((u) => u.id);
  const logins = ids.length
    ? await db.auditLog.groupBy({ by: ["actorId"], where: { actorId: { in: ids }, action: "auth.login" }, _max: { createdAt: true } })
    : [];
  const lastLogin = new Map(logins.map((l) => [l.actorId, l._max.createdAt]));

  return (
    <div>
      <PageHeader title="Users" description="Every account across all customers." meta={<span className="tabular-nums">{total.toLocaleString()} matching</span>} />
      <Card>
        <FilterBar action="/admin/users" resetHref="/admin/users">
          <FilterInput name="q" label="Search" defaultValue={q} placeholder="Email, name or id" type="search" />
          <FilterSelect
            name="kind"
            label="Show"
            defaultValue={kind}
            options={[
              { value: "staff", label: "Staff only" },
              { value: "unverified", label: "Unverified email" },
            ]}
          />
        </FilterBar>
        {users.length === 0 ? (
          <EmptyState icon={<Users />} title="No users match" />
        ) : (
          <Table caption="Users" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Organizations</TH>
                <TH>Email</TH>
                <TH>Last sign-in</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <tbody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {u.email}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {u.name ?? "—"} {u.isStaff && <Badge tone="danger">staff</Badge>}
                    </div>
                  </TD>
                  <TD className="text-xs">
                    {u.memberships.length === 0 ? (
                      <span className="text-muted">None</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {u.memberships.map((m) => (
                          <li key={m.organization.id}>
                            <Link href={`/admin/customers/${m.organization.id}`} className="text-fg-soft hover:text-primary hover:underline">
                              {m.organization.name}
                            </Link>{" "}
                            <span className="text-muted">({m.role})</span>
                          </li>
                        ))}
                        {u._count.memberships > u.memberships.length && <li className="text-muted">+{u._count.memberships - u.memberships.length} more</li>}
                      </ul>
                    )}
                  </TD>
                  <TD>{u.emailVerified ? <Badge tone="success">verified</Badge> : <Badge tone="warning">unverified</Badge>}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted">{fmtAgo(lastLogin.get(u.id) ?? null)}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">
                    {fmtDate(u.createdAt)}
                    <div>
                      <Mono>{u.id}</Mono>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/users" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
