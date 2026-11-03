import { Suspense } from "react";
import { Building2, Coins, FolderKanban, Globe2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PLANS, getPlan } from "@/lib/billing/plans";
import { getUsageSummary } from "@/lib/billing/usage";
import { requireAppSession, hasRole } from "@/lib/dashboard/server";
import { fmtDate, humanize } from "@/lib/dashboard/format";
import { MembersPanel } from "@/components/app/members-panel";
import { roleLabel } from "@/components/app/role-label";
import { BillingPlans } from "@/components/app/billing-panel";
import { BrandingPanel } from "@/components/app/settings/branding-panel";
import { canHidePoweredBy, isBrandingEligible, readStoredBranding } from "@/lib/branding";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValueList,
  LinkButton,
  Meter,
  Notice,
  PageHeader,
  SectionHeading,
  Skeleton,
  Stat,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { SettingsTabs } from "./settings-tabs";
import { AccountPanel } from "./account-panel";

export const metadata = { title: "Settings" };

const TASK_LABEL: Record<string, string> = {
  crawl_page: "Website checks",
  visibility_prompt: "AI checks",
  brand_probe: "AI knows you checks",
  content_generation: "Writing suggested fixes",
  llm_analysis: "AI analysis",
};

const REGION_LABEL: Record<string, string> = { IN: "India", US: "United States", EU: "European Union", GB: "United Kingdom" };

export default async function SettingsPage() {
  const s = await requireAppSession();
  const [org, usage, sub, projectCount, memberCount, me] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: s.organizationId },
      select: { name: true, planId: true, status: true, region: true, createdAt: true, publishingEnabled: true, serviceTier: true, branding: true },
    }),
    getUsageSummary(s.organizationId),
    db.subscription.findFirst({
      where: { organizationId: s.organizationId },
      orderBy: { createdAt: "desc" },
      select: { status: true, currentPeriodEnd: true, trialEndsAt: true },
    }),
    db.project.count({ where: { organizationId: s.organizationId } }),
    db.membership.count({ where: { organizationId: s.organizationId, status: { not: "removed" } } }),
    db.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true, emailVerified: true, createdAt: true } }),
  ]);
  const plan = getPlan(org.planId);
  const byType = Object.entries(usage.byTaskType).sort((a, b) => b[1] - a[1]);
  const canManage = hasRole(s, "admin");
  const planHint =
    sub?.trialEndsAt && sub.status === "trialing"
      ? `Trial ends ${fmtDate(sub.trialEndsAt)}`
      : sub?.currentPeriodEnd
        ? `Renews ${fmtDate(sub.currentPeriodEnd)}`
        : undefined;
  const creditsLeft = Math.max(0, usage.limit - usage.used - usage.reserved);

  const workspace = (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader icon={<Building2 />} title="Workspace details" description="The basics about your organization." />
        <CardBody>
          <KeyValueList
            items={[
              { label: "Name", value: org.name },
              { label: "Data region", value: REGION_LABEL[org.region] ?? org.region, hint: "Where your data is stored" },
              { label: "Created", value: fmtDate(org.createdAt) },
              {
                label: "Status",
                value: (
                  <Badge tone={org.status === "active" ? "success" : "danger"} variant="dot">
                    {humanize(org.status)}
                  </Badge>
                ),
              },
              { label: "Your role", value: roleLabel(s.role) },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<ShieldCheck />} title="Website changes" description="Whether approved fixes can go live on your website." />
        <CardBody className="space-y-3">
          <Badge tone={org.publishingEnabled ? "success" : "danger"} variant="dot">
            {org.publishingEnabled ? "Fixes can go live" : "Fixes paused"}
          </Badge>
          <p className="text-small text-fg-soft">
            {org.publishingEnabled
              ? "Fixes you approve can go live on your connected websites. Every change is recorded and can be undone."
              : "No fixes will go live on your websites right now. Contact us if you didn't expect this."}
          </p>
        </CardBody>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
        <Stat label="Projects" value={`${projectCount} / ${plan.maxProjects}`} icon={<FolderKanban />} hint="Websites you're following" />
        <Stat label="Team seats" value={`${memberCount} / ${plan.seats}`} icon={<Users />} hint="People with access" />
        <Stat label="Plan" value={plan.name} icon={<Globe2 />} hint={planHint ?? "Change it under Billing & usage"} />
      </div>
    </div>
  );

  const billing = (
    <div className="space-y-10">
      <section aria-labelledby="usage-h" className="space-y-5">
        <SectionHeading id="usage-h" title="This month's usage" description={`Billing period ${usage.period}. Credits are used when we check your website or ask AI tools.`} />
        {org.status !== "active" && (
          <Notice tone="danger" title={`Your account is ${humanize(org.status).toLowerCase()}`}>
            New scans may be paused until billing is sorted out.
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Credits used"
            icon={<Coins />}
            value={<span className="tabular-nums">{usage.used.toLocaleString()}</span>}
            hint={`of ${usage.limit.toLocaleString()} this month`}
            footer={<Meter value={usage.used + usage.reserved} max={Math.max(usage.limit, 1)} label="Credits used this period" showValue />}
          />
          <Stat
            label="Credits left"
            value={<span className="tabular-nums">{creditsLeft.toLocaleString()}</span>}
            hint={usage.reserved ? `${usage.reserved.toLocaleString()} held for jobs that are running` : "Nothing on hold right now"}
          />
          <Stat
            label="Current plan"
            value={
              <span className="flex flex-wrap items-center gap-2">
                {plan.name}
                {org.status !== "active" && <Badge tone="danger">{humanize(org.status)}</Badge>}
              </span>
            }
            hint={planHint}
          />
        </div>
        <Card>
          <CardHeader title="Where your credits went" description="Grouped by type of work." />
          {byType.length === 0 ? (
            <EmptyState size="sm" icon={<Coins />} title="No credits used yet this month" description="Check a website or run an AI check to see usage here."
              action={<LinkButton href="/app" variant="secondary">Go to your projects</LinkButton>}
            />
          ) : (
            <Table caption="Credits by task type" zebra>
              <THead>
                <tr>
                  <TH>Type of work</TH>
                  <TH align="right">Credits</TH>
                  <TH align="right">Share</TH>
                </tr>
              </THead>
              <tbody>
                {byType.map(([t, n]) => (
                  <TR key={t}>
                    <TD className="font-medium text-fg">{TASK_LABEL[t] ?? humanize(t)}</TD>
                    <TD numeric>{n.toLocaleString()}</TD>
                    <TD numeric className="text-muted">
                      {usage.used ? `${Math.round((n / usage.used) * 100)}%` : "—"}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>
      <section aria-labelledby="plans-h" className="space-y-5">
        <SectionHeading id="plans-h" title="Plans" description="All prices are per month, in Indian Rupees." />
        <BillingPlans plans={Object.values(PLANS)} currentPlanId={org.planId} canManage={canManage} />
      </section>
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="Manage your workspace, team, plan and your own account." meta={<span>{org.name}</span>} />
      <Suspense fallback={<Skeleton className="h-10 w-80" />}>
        <SettingsTabs
          memberCount={memberCount}
          workspace={workspace}
          members={<MembersPanel canManage={canManage} currentUserId={s.userId} seatLimit={plan.seats} />}
          billing={billing}
          branding={
            <BrandingPanel
              eligible={isBrandingEligible(org)}
              canHidePoweredBy={canHidePoweredBy(org)}
              canManage={canManage}
              stored={readStoredBranding(org.branding)}
              orgName={org.name}
            />
          }
          account={
            me ? (
              <AccountPanel user={{ name: me.name, email: me.email, emailVerified: me.emailVerified, createdAt: me.createdAt.toISOString() }} />
            ) : undefined
          }
        />
      </Suspense>
    </>
  );
}
