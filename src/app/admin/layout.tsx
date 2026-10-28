// Admin back-office shell. Staff only: everyone else gets a 404 (the admin surface is never revealed).
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { ToastProvider } from "@/components/ui";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const supportOrg = staff.session.staffMode
    ? await db.organization.findUnique({ where: { id: staff.session.organizationId }, select: { name: true } })
    : null;
  return (
    <ToastProvider>
      <AdminShell staffEmail={staff.user.email} staffName={staff.user.name} supportOrgName={supportOrg?.name ?? null}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
