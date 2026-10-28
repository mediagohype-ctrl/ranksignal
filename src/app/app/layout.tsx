import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { AppSidebar } from "@/components/app/sidebar";
import { NotificationsBell, UsageMeter, UserMenu } from "@/components/app/topbar-widgets";
import { Badge, Divider, ToastProvider } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/app");

  const [org, projects, user] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId }, select: { name: true, planId: true, status: true } }),
    db.project.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true, websiteUrl: true },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }),
  ]);
  if (!org) redirect("/login");
  const plan = getPlan(org.planId);
  const trial = org.planId === "trial";

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-small focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen bg-bg">
        <AppSidebar projects={projects} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4 lg:px-8">
            <div className="ml-12 flex min-w-0 items-center gap-2 lg:ml-0">
              <span className="truncate text-small font-semibold text-fg">{org.name}</span>
              <Badge tone={trial ? "warning" : "primary"} size="sm" className="shrink-0">
                {plan.name}
              </Badge>
              {org.status !== "active" && (
                <Badge tone="danger" size="sm" className="hidden shrink-0 capitalize sm:inline-flex">
                  {org.status.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <UsageMeter />
              <Divider orientation="vertical" className="hidden md:inline-block" />
              <NotificationsBell />
              <UserMenu
                name={user?.name ?? null}
                email={user?.email ?? session.email}
                role={session.role}
                orgName={org.name}
              />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
