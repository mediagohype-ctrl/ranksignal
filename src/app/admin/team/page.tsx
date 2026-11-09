// Team & roles: who can open which admin section. Super admins only (team.manage).
import { requireStaffPage } from "@/lib/admin/guard";
import { ADMIN_SECTIONS, PERMISSIONS, STAFF_ROLE_IDS, STAFF_ROLES, type Permission } from "@/lib/admin/rbac";
import { listStaff } from "@/lib/admin/team";
import { fmtDate, str, type SearchParams } from "@/lib/admin/params";
import { Card, CardBody, CardHeader, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { AddStaffForm, CreateAccountForm, TeamMemberRow, type RoleOption } from "@/components/admin/team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team & roles" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaffPage("team.manage");
  const sp = await searchParams;
  const members = await listStaff();
  const options: RoleOption[] = STAFF_ROLE_IDS.map((id) => ({ id, label: STAFF_ROLES[id].label, description: STAFF_ROLES[id].description }));
  const has = (role: (typeof STAFF_ROLE_IDS)[number], p: Permission) => (STAFF_ROLES[role].permissions as readonly Permission[]).includes(p);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & roles"
        description="Give each team member only the sections they need. Changes apply on their next click and are audit-logged."
      />

      <Card>
        <CardHeader
          title="Create an employee account"
          description="For new team members: you set (or generate) their password and hand it over. They can sign in at /login straight away."
        />
        <CardBody>
          <CreateAccountForm options={options} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Add an existing account"
          description="They already signed up themselves — give them staff roles. A person with several roles gets all of their sections."
        />
        <CardBody>
          <AddStaffForm options={options} initialEmail={str(sp, "email") ?? undefined} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Team (${members.length})`} />
        <CardBody>
          <ul className="space-y-3">
            {members.map((m) => (
              <TeamMemberRow
                key={m.id}
                options={options}
                member={{ id: m.id, email: m.email, name: m.name, roles: m.staffRoles, since: fmtDate(m.createdAt), isSelf: m.id === staff.user.id }}
              />
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What each role can open" description="✓ = can see the section. Change rights (edit, approve, export) are listed under it." />
        <div className="overflow-x-auto">
          <Table caption="Role access matrix" density="compact" zebra>
            <THead>
              <TR>
                <TH>Section</TH>
                {STAFF_ROLE_IDS.map((r) => (
                  <TH key={r} align="center">
                    {STAFF_ROLES[r].label}
                  </TH>
                ))}
              </TR>
            </THead>
            <tbody>
              {ADMIN_SECTIONS.map((s) => (
                <TR key={s.href}>
                  <TD>{s.label}</TD>
                  {STAFF_ROLE_IDS.map((r) => (
                    <TD key={r} align="center">
                      {has(r, s.permission) ? "✓" : ""}
                    </TD>
                  ))}
                </TR>
              ))}
              {(Object.keys(PERMISSIONS) as Permission[])
                .filter((p) => !p.endsWith(".view") && p !== "team.manage")
                .map((p) => (
                  <TR key={p}>
                    <TD>
                      <span className="text-xs text-muted">{PERMISSIONS[p]}</span>
                    </TD>
                    {STAFF_ROLE_IDS.map((r) => (
                      <TD key={r} align="center">
                        {has(r, p) ? "✓" : ""}
                      </TD>
                    ))}
                  </TR>
                ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
