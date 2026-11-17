import { Suspense } from "react";
import { Bot, Building2, FolderKanban, Globe2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PLANS, getPlan, plansShownTo } from "@/lib/billing/plans";
import { getAiAllowance } from "@/lib/billing/allowance";
import { answersPerCheck, getEngineLimit, questionsPerCheck } from "@/lib/billing/plans";
import { answersLeftLabel, fullChecksIn } from "@/lib/billing/topups";
import { OFFER_SALES_LINE, offerName } from "@/lib/billing/offer";
import { billingOfferCards } from "@/lib/billing/offer-cards";
import { PLANS_SECTION_ID } from "@/lib/billing/links";
import { ExtraAnswersCard } from "@/components/app/billing/topup-dialog";
import { requireAppSession, hasRole } from "@/lib/dashboard/server";
import { fmtDate, humanize } from "@/lib/dashboard/format";
import { MembersPanel } from "@/components/app/members-panel";
import { roleLabel } from "@/components/app/role-label";
import { BillingPlans } from "@/components/app/billing-panel";
import { BillingDetailsForm } from "@/components/app/billing/billing-details-form";
import { InvoicesList } from "@/components/app/billing/invoices-list";
import { getBillingDetails, hasInvoiceBasics } from "@/lib/billing/billing-details";
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
import { expertModeHelp } from "@/components/app/nav";
import { sessionCanConnect } from "@/lib/dashboard/menu";

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
          {/* Do it myself has no website connections: the owner makes every change (owner decision 1). */}
          {!sessionCanConnect(org, s) ? (
            <>
              <Badge tone="neutral" variant="dot">
                You make the changes
              </Badge>
              <p className="text-small text-fg-soft">
                On Do it myself nothing changes your website automatically. Every fix comes with ready-to-paste text and steps.
              </p>
            </>
          ) : (
            <>
              <Badge tone={org.publishingEnabled ? "success" : "danger"} variant="dot">
                {org.publishingEnabled ? "Fixes can go live" : "Fixes paused"}
              </Badge>
              <p className="text-small text-fg-soft">
                {org.publishingEnabled
                  ? "Fixes you approve can go live on your connected websites. Every change is recorded and can be undone."
                  : "No fixes will go live on your websites right now. Contact us if you didn't expect this."}
              </p>
            </>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
        <Stat label="Websites" value={`${projectCount} / ${plan.maxProjects}`} icon={<FolderKanban />} hint="Websites you're following" />
        <Stat label="Team seats" value={`${memberCount} / ${plan.seats}`} icon={<Users />} hint="People with access" />
        <Stat label="Plan" value={plan.name} icon={<Globe2 />} hint={planHint ?? "Change it under Billing & usage"} />
      </div>
    </div>
  );

  // Billing copy: what one full AI check uses on this plan, and how many full checks the answers left cover.
  const perCheck = answersPerCheck(org.planId);
  const perCheckParts = `${questionsPerCheck(org.planId)} questions × ${getEngineLimit(org.planId)} AI tools`;
  const checksLeft = ai ? fullChecksIn(ai.left, perCheck) : null;

  const billing = (
    <div className="space-y-10">
      <section aria-labelledby="usage-h" className="space-y-5">
        <SectionHeading
          id="usage-h"
          title="This month's AI answers"
          description={`One AI answer is one of your customer questions asked to one AI tool. One full AI check uses ${perCheck.toLocaleString("en-IN")} answers (${perCheckParts}).`}
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
            value={<span className="tabular-nums">{perCheck.toLocaleString("en-IN")} answers</span>}
            hint={
              checksLeft === null
                ? perCheckParts
                : `${perCheckParts}. Your answers left cover ${checksLeft.toLocaleString("en-IN")} full ${checksLeft === 1 ? "check" : "checks"}.`
            }
          />
          <Stat
            label="Current plan"
            value={
              <span className="flex flex-wrap items-center gap-2">
                {org.serviceTier ? offerName(org) : plan.name}
                {org.status !== "active" && <Badge tone="danger">{humanize(org.status)}</Badge>}
              </span>
            }
            hint={planHint}
          />
        </div>
        <ExtraAnswersCard canManage={canManage} />
      </section>
      {/* Every "Upgrade" button links here (UPGRADE_HREF → #plans). */}
      <section id={PLANS_SECTION_ID} aria-labelledby="plans-h" className="scroll-mt-24 space-y-5">
        <SectionHeading
          id="plans-h"
          title="Plans"
          description={
            gst.registered
              ? `${OFFER_SALES_LINE} Prices are per month, in Indian Rupees, plus ${gst.ratePercent}% GST. You see the total before you pay.`
              : `${OFFER_SALES_LINE} Prices are per month, in Indian Rupees.`
          }
        />
        <BillingPlans
          plans={plansShownTo(org.planId).map((id) => PLANS[id])}
          currentPlanId={org.planId}
          canManage={canManage}
          prices={planPrices}
          hasBillingDetails={hasInvoiceBasics(billingDetails)}
          offers={billingOfferCards(org, { gst: gst.registered })}
          states={INDIAN_STATES}
          businessName={org.name}
        />
      </section>
      {canManage && (
        <section id="billing-details" aria-labelledby="billing-details-h" className="scroll-mt-24 space-y-5">
          <SectionHeading
            id="billing-details-h"
            title="Billing details"
            description="The business name, GSTIN and state printed on your invoices. We ask for the name and state before your first payment. Changes apply to future invoices."
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
          <SectionHeading id="invoices-h" title="Invoices" description="A GST invoice for every payment. We email each one to you; open one here to print it or save it as a PDF." />
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
                <PreferencesPanel expertMode={me.expertMode} timeZone={me.timeZone} expertHelp={expertModeHelp(sessionCanConnect(org, s))} />
                <AccountPanel user={{ name: me.name, email: me.email, emailVerified: me.emailVerified, createdAt: me.createdAt.toISOString() }} />
              </div>
            ) : undefined
          }
        />
      </Suspense>
    </>
  );
}
