// Settings → Plan (brief 5.8): plan name, "AI answers left: X of Y", renew date, Upgrade (→ the plan cards in
// Billing: Do it myself, Do it for me, Custom). Server component.
import { CreditCard } from "lucide-react";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { offerName } from "@/lib/billing/offer";
import { UPGRADE_HREF } from "@/lib/billing/links";
import { getAiAllowance } from "@/lib/billing/allowance";
import { answersLeftLabel } from "@/lib/billing/topups";
import { fmtDate } from "@/lib/dashboard/format";
import { Card, CardBody, CardHeader, KeyValueList, LinkButton, Meter } from "@/components/ui";

export async function PlanSection({ organizationId, timeZone }: { organizationId: string; timeZone?: string | null }) {
  const [org, sub, allowance] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, serviceTier: true } }),
    db.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { status: true, currentPeriodEnd: true, trialEndsAt: true },
    }),
    getAiAllowance(organizationId).catch(() => null),
  ]);
  const plan = getPlan(org?.planId ?? "trial");
  const renew =
    sub?.status === "trialing" && sub.trialEndsAt
      ? { label: "Trial ends", value: fmtDate(sub.trialEndsAt, false, timeZone) }
      : sub?.currentPeriodEnd
        ? { label: "Renews", value: fmtDate(sub.currentPeriodEnd, false, timeZone) }
        : null;

  return (
    <Card as="section">
      <CardHeader
        icon={<CreditCard />}
        title="Plan"
        actions={
          <LinkButton href={UPGRADE_HREF} variant="secondary" size="sm">
            {org?.serviceTier ? "See plans" : "Upgrade"}
          </LinkButton>
        }
      />
      <CardBody className="space-y-4">
        <KeyValueList
          items={[
            { label: "Plan", value: org?.serviceTier ? offerName(org) : plan.name },
            ...(allowance
              ? [
                  {
                    label: "AI answers left",
                    value: answersLeftLabel({ monthlyLeft: allowance.monthlyLeft, cap: allowance.cap, extraLeft: allowance.extra.left }, allowance.resetsAt === null),
                  },
                ]
              : []),
            ...(renew ? [renew] : []),
          ]}
        />
        {allowance && allowance.cap > 0 && (
          <Meter value={allowance.used} max={allowance.cap} label="AI answers used this month" size="xs" />
        )}
      </CardBody>
    </Card>
  );
}
