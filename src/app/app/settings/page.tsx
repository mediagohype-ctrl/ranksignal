import { Suspense } from "react";
import { Bot, Building2, FolderKanban, Globe2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PLANS, getPlan, plansShownTo } from "@/lib/billing/plans";
import { getAiAllowance } from "@/lib/billing/allowance";
import { answersPerCheck } from "@/lib/billing/plans";
import { answersLeftLabel } from "@/lib/billing/topups";
import { ExtraAnswersCard } from "@/components/app/billing/topup-dialog";
import { requireAppSession, hasRole } from "@/lib/dashboard/server";
import { fmtDate, humanize } from "@/lib/dashboard/format";
import { MembersPanel } from "@/components/app/members-panel";
import { roleLabel } from "@/components/app/role-label";
import { BillingPlans } from "@/components/app/billing-panel";
import { BillingDetailsForm } from "@/components/app/billing/billing-details-form";
import { InvoicesList } from "@/components/app/billing/invoices-list";
import { getBillingDetails } from "@/lib/billing/billing-details";
import { listInvoices } from "@/lib/billing/invoice";
import { gstConfig, planPriceWithGst } from "@/lib/billing/gst";
import { INDIAN_STATES } from "@/lib/billing/indian-states";
import { BrandingPanel } from "@/components/app/settings/branding-panel";
import { canHidePoweredBy, isBrandingEligible, readStoredBranding } from "@/lib/branding";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  KeyValueList,
  Meter,
  Notice,
  PageHeader,
  SectionHeading,
  Skeleton,
  Stat,
} from "@/components/ui";
import { SettingsTabs } from "./settings-tabs";
import { AccountPanel } from "./account-panel";
import { PreferencesPanel } from "@/components/app/project-settings/preferences-panel";

export const metadata = { title: "Settings" };

const REGION_LABEL: Record<string, string> = { IN: "India", US: "United States", EU: "European Union", GB: "United Kingdom" };

export default async function SettingsPage() {
  const s = await requireAppSession();
  const [org, ai, sub, projectCount, memberCount, me] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: s.organizationId },
      select: { name: true, planId: true, status: true, region: true, createdAt: true, publishingEnabled: true, serviceTier: true, branding: true },
    }),
    // Customers see AI answers left, never internal credits.
    getAiAllowance(s.organizationId).catch(() => null),
    db.subscription.findFirst({
      where: { organizationId: s.organizationId },
      orderBy: { createdAt: "desc" },
      select: { status: true, currentPeriodEnd: true, trialEndsAt: true },
    }),
    db.project.count({ where: { organizationId: s.organizationId } }),
    db.membership.count({ where: { organizationId: s.organizationId, status: { not: "removed" } } }),
    db.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true, emailVerified: true, createdAt: true, expertMode: true, timeZone: true } }),
  ]);
  const plan = getPlan(org.planId);
  const canManage = hasRole(s, "admin");
  // GST invoices + billing details are for the Owner/Admin (the people who pay).
  const [billingDetails, invoices] = canManage
    ? await Promise.all([getBillingDetails(s.organizationId).catch(() => null), listInvoices(s.organizationId).catch(() => [])])
    : [null, []];
  const gst = gstConfig();
  const planPrices = Object.fromEntries(Object.values(PLANS).map((p) => [p.id, planPriceWithGst(p.id, billingDetails?.stateCode)]));
  const planHint =
    sub?.trialEndsAt && sub.status === "trialing"
      ? `Trial ends ${fmtDate(sub.trialEndsAt)}`
      : sub?.currentPeriodEnd
        ? `Renews ${fmtDate(sub.currentPeriodEnd)}`
        : undefined;

  const workspace = (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader icon={<Building2 />} title="Your business" description="The basics about your account." />
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
        <Stat label="Websites" value={`${projectCount} / ${plan.maxProjects}`} icon={<FolderKanban />} hint="Websites you're following" />
        <Stat label="Team seats" value={`${memberCount} / ${plan.seats}`} icon={<Users />} hint="People with access" />
        <Stat label="Plan" value={plan.name} icon={<Globe2 />} hint={planHint ?? "Change it under Billing & usage"} />
      </div>
    </div>
  );

  const billing = (
    <div className="space-y-10">
      <section aria-labelledby="usage-h" className="space-y-5">
        <SectionHeading
          id="usage-h"
          title="This month's AI answers"
          description="One AI answer is one of your customer questions asked to one AI assistant."
        />
        {org.status !== "active" && (
          <Notice tone="danger" title={`Your account is ${humanize(org.status).toLowerCase()}`}>
            New checks may be paused until billing is sorted out.
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="AI answers left"
            icon={<Bot />}
            value={
              <span className="tabular-nums">
                {ai ? answersLeftLabel({ monthlyLeft: ai.monthlyLeft, cap: ai.cap, extraLeft: ai.extra.left }, org.planId === "trial") : "—"}
              </span>
            }
            hint={ai?.resetsAt ? `Resets on ${fmtDate(ai.resetsAt)}` : org.planId === "trial" ? "These cover your whole free trial" : undefined}
            footer={ai ? <Meter value={ai.used} max={Math.max(ai.cap, 1)} label="AI answers used" showValue /> : undefined}
          />
          <Stat
            label="One AI check uses"
            value={<span className="tabular-nums">{answersPerCheck(org.planId).toLocaleString("en-IN")} answers</span>}
            hint="Questions per check × AI assistants per check"
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
        <ExtraAnswersCard canManage={canManage} />
      </section>
      <section aria-labelledby="plans-h" className="space-y-5">
        <SectionHeading
          id="plans-h"
          title="Plans"
          description={
            gst.registered
              ? `All prices are per month, in Indian Rupees, plus ${gst.ratePercent}% GST. You see the total before you pay.`
              : "All prices are per month, in Indian Rupees."
          }
        />
        <BillingPlans
          plans={plansShownTo(org.planId).map((id) => PLANS[id])}
          currentPlanId={org.planId}
          canManage={canManage}
          prices={planPrices}
          hasBillingDetails={!!billingDetails}
        />
      </section>
      {canManage && (
        <section aria-labelledby="billing-details-h" className="space-y-5">
          <SectionHeading
            id="billing-details-h"
            title="Billing details"
            description="The business name, GSTIN and state printed on your invoices. Changes apply to future invoices."
          />
          <Card>
            <CardBody>
              <BillingDetailsForm
                initial={billingDetails}
                states={INDIAN_STATES}
                defaultName={org.name}
                canManage={canManage}
              />
            </CardBody>
          </Card>
        </section>
      )}
      {canManage && (
        <section aria-labelledby="invoices-h" className="space-y-5">
          <SectionHeading id="invoices-h" title="Invoices" description="A GST invoice for every payment. Open one to print or save it as a PDF." />
          <InvoicesList
            invoices={invoices.map((i) => ({ id: i.id, number: i.number, description: i.description, totalPaise: i.totalPaise, paidAt: i.paidAt }))}
          />
        </section>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="Your business, team, plan and your own account." meta={<span>{org.name}</span>} />
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
              <div className="space-y-6">
                <PreferencesPanel expertMode={me.expertMode} timeZone={me.timeZone} />
                <AccountPanel user={{ name: me.name, email: me.email, emailVerified: me.emailVerified, createdAt: me.createdAt.toISOString() }} />
              </div>
            ) : undefined
          }
        />
      </Suspense>
    </>
  );
}
