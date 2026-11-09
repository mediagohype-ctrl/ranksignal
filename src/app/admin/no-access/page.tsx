// Shown to staff who open an admin section their role doesn't include.
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireStaffPage } from "@/lib/admin/guard";
import { firstAllowedPath, PERMISSIONS, roleLabels, type Permission } from "@/lib/admin/rbac";
import { str, type SearchParams } from "@/lib/admin/params";
import { Card, CardBody, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "No access" };

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaffPage();
  const need = str(await searchParams, "need");
  const needLabel = need && need in PERMISSIONS ? PERMISSIONS[need as Permission] : null;
  const home = firstAllowedPath(staff.permissions);
  const roles = roleLabels(staff.roles);

  return (
    <div className="space-y-6">
      <PageHeader title="You don't have access to this section" description="Admin sections are shown by team role." />
      <Card>
        <CardBody className="space-y-4">
          <p className="flex items-center gap-2 text-small text-fg">
            <Lock aria-hidden className="size-4 text-muted" />
            {needLabel ? (
              <span>
                This needs permission to: <strong>{needLabel}</strong>.
              </span>
            ) : (
              <span>Your role doesn&apos;t include this section.</span>
            )}
          </p>
          <p className="text-small text-fg-soft">
            Your roles: <strong>{roles.length ? roles.join(", ") : "none yet"}</strong>. Ask a super admin to add a role on the{" "}
            <em>Team &amp; roles</em> page.
          </p>
          {home && (
            <p>
              <Link href={home} className="text-small font-medium text-primary hover:underline">
                Go to your sections →
              </Link>
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
