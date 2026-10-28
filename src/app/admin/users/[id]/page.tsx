// User detail: memberships, verification, staff flag, recent sign-ins and activity; account actions.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { fmtAgo, fmtDate, fmtDateTime } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, EmptyState, KeyValueList, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { Mono, PlanBadge, StatusPill, TierBadge } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "User" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage();
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      emailVerified: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
          organization: { select: { id: true, name: true, planId: true, serviceTier: true, status: true } },
        },
      },
    },
  });
  if (!user) notFound();
  const [logins, activity] = await Promise.all([
    db.auditLog.findMany({ where: { actorId: id, action: "auth.login" }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, createdAt: true, ip: true } }),
    db.auditLog.findMany({
      where: { OR: [{ actorId: id }, { resourceType: "user", resourceId: id }] },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, action: true, actorType: true, organizationId: true, createdAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        breadcrumbs={[{ label: "Users", href: "/admin/users" }, { label: user.email }]}
        title={user.email}
        description={user.name ?? undefined}
        meta={
          <>
            {user.isStaff && <Badge tone="danger">Staff</Badge>}
            {user.emailVerified ? <Badge tone="success">Email verified</Badge> : <Badge tone="warning">Email not verified</Badge>}
            <Mono>{user.id}</Mono>
          </>
        }
      />
      <Card padding="md">
        <UserActions userId={user.id} isStaff={user.isStaff} isSelf={user.id === staff.user.id} emailVerified={user.emailVerified} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <KeyValueList
              items={[
                { label: "Created", value: fmtDate(user.createdAt) },
                { label: "Last sign-in", value: logins[0] ? `${fmtDateTime(logins[0].createdAt)} (${fmtAgo(logins[0].createdAt)})` : "No sign-in recorded" },
                { label: "Email verified", value: user.emailVerified ? "Yes" : "No" },
                { label: "Staff", value: user.isStaff ? "Yes" : "No" },
                { label: "Memberships", value: user.memberships.length },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Organizations" />
          {user.memberships.length === 0 ? (
            <EmptyState size="sm" title="No memberships" />
          ) : (
            <Table caption="Memberships" density="compact" zebra>
              <THead>
                <tr>
                  <TH>Organization</TH>
                  <TH>Role</TH>
                  <TH>Membership</TH>
                  <TH>Plan</TH>
                  <TH>Joined</TH>
                </tr>
              </THead>
              <tbody>
                {user.memberships.map((m) => (
                  <TR key={m.id}>
                    <TD>
                      <Link href={`/admin/customers/${m.organization.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                        {m.organization.name}
                      </Link>
                      <div>
                        <StatusPill status={m.organization.status} />
                      </div>
                    </TD>
                    <TD className="capitalize">{m.role}</TD>
                    <TD>
                      <StatusPill status={m.status} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <PlanBadge planId={m.organization.planId} />
                        <TierBadge tier={m.organization.serviceTier} />
                      </div>
                    </TD>
                    <TD className="text-xs tabular-nums text-muted">{fmtDate(m.createdAt)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader title="Recent activity" description="Audit events by or about this user (latest 25)." actions={<Link href={`/admin/audit?actor=${user.id}`} className="text-small font-medium text-primary hover:underline">Full audit log →</Link>} />
        {activity.length === 0 ? (
          <EmptyState size="sm" title="No activity recorded" />
        ) : (
          <Table caption="Recent activity" density="compact" zebra>
            <THead>
              <tr>
                <TH>Action</TH>
                <TH>Actor</TH>
                <TH>Organization</TH>
                <TH>When</TH>
              </tr>
            </THead>
            <tbody>
              {activity.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-fg">{a.action}</TD>
                  <TD>{a.actorType}</TD>
                  <TD>{a.organizationId ? <Link href={`/admin/customers/${a.organizationId}`} className="font-mono text-xs text-primary hover:underline">{a.organizationId}</Link> : "—"}</TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(a.createdAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
