// Admin back-office shell. Staff only: everyone else gets a 404 (the admin surface is never revealed).
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { ToastProvider } from "@/components/ui";
import { AdminShell } from "@/components/admin/shell";
import { roleLabels } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const since24h = new Date(Date.now() - 24 * 60 * 60_000);
  const [toolRuns24h, newLeads24h] = staff.permissions.has("leads.view")
    ? await Promise.all([
        db.toolUse.count({ where: { createdAt: { gte: since24h }, ok: true } }).catch(() => 0),
        db.lead.count({ where: { createdAt: { gte: since24h }, status: "new" } }).catch(() => 0),
      ])
    : [0, 0];
  const supportOrg = staff.session.staffMode
    ? await db.organization.findUnique({ where: { id: staff.session.organizationId }, select: { name: true } })
    : null;
  return (
    <ToastProvider>
      <AdminShell staffEmail={staff.user.email} staffName={staff.user.name} supportOrgName={supportOrg?.name ?? null}
        permissions={[...staff.permissions]}
        roleLabels={roleLabels(staff.roles)}
        badges={{ "/admin/tools": toolRuns24h, "/admin/leads": newLeads24h }}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
