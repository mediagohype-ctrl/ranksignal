"use client";
import { useState } from "react";
import { CalendarClock, CreditCard, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Badge, Button, Dialog, KeyValueList, Meter, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/dashboard/format";
import { answersLeftLabel } from "@/lib/billing/topups";

export interface BillingInfo {
  checkoutAvailable: boolean;
  checkoutPlans: string[];
  supportEmail: string;
  subscription: {
    planId: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export interface UsageResponse {
  plan: { id: string; name: string };
  access: { active: boolean; reason?: string; trialEndsAt?: string | null; trialDaysLeft: number | null; message: string; graceEndsAt?: string | null };
  /** AI answers this month (GET /api/usage → getVisibilityRunAllowance): limit = answers per month, remaining = left. */
  aiChecks: { used: number; limit: number; remaining: number; monthlyLeft?: number; extraLeft?: number; maxPromptsPerRun: number; answersPerCheck?: number; resetsAt?: string | null };
  billing: BillingInfo;
}

export function fmtDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : fmtDate(d);
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trial", tone: "neutral" },
  past_due: { label: "Payment due", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Ended", tone: "neutral" },
};

export function SubscriptionSummary({ usage, canManage, onChanged }: { usage: UsageResponse; canManage: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const sub = usage.billing.subscription;
  const periodEnd = fmtDay(sub?.currentPeriodEnd);
  const status = sub ? (STATUS[sub.status] ?? { label: sub.status, tone: "neutral" as const }) : null;
  const cancellable = !!sub && ["active", "past_due"].includes(sub.status) && !sub.cancelAtPeriodEnd;

  async function cancel() {
    setBusy(true);
    try {
      await api("/api/billing/cancel", { method: "POST", body: {} });
      toast(periodEnd ? `Cancelled. Your plan stays active until ${periodEnd}.` : "Cancelled at the end of this billing period.", "success");
      setConfirm(false);
      onChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const items = [
    {
      label: "Plan",
      value: (
        <span className="flex items-center gap-2">
          <span className="font-medium text-fg">{usage.plan.name}</span>
          {status && (
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
          )}
          {sub?.cancelAtPeriodEnd && (
            <Badge tone="warning" size="sm">
              Ends at the end of this billing period
            </Badge>
          )}
        </span>
      ),
    },
    ...(sub && periodEnd
      ? [{ label: sub.cancelAtPeriodEnd || sub.status === "cancelled" ? "Active until" : "Renews on", value: periodEnd }]
      : []),
    ...(usage.plan.id === "trial" && usage.access.trialEndsAt
      ? [{ label: usage.access.active ? "Trial ends" : "Trial ended", value: fmtDay(usage.access.trialEndsAt) ?? "—" }]
      : []),
  ];

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:grid-cols-2">
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-h4 text-fg">
          <CreditCard size={18} aria-hidden className="text-muted" /> Your subscription
        </h3>
        <KeyValueList items={items} />
        {cancellable && canManage && (
          <Button variant="ghost" size="sm" icon={<XCircle />} onClick={() => setConfirm(true)}>
            Cancel subscription
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-h4 text-fg">
          <CalendarClock size={18} aria-hidden className="text-muted" /> AI answers
        </h3>
        <Meter value={usage.aiChecks.used} max={Math.max(1, usage.aiChecks.limit)} label="AI answers used" showValue />
        <p className="text-small text-fg">
          AI answers left:{" "}
          {answersLeftLabel(
            {
              monthlyLeft: usage.aiChecks.monthlyLeft ?? usage.aiChecks.remaining,
              cap: usage.aiChecks.limit,
              extraLeft: usage.aiChecks.extraLeft ?? 0,
            },
            usage.plan.id === "trial",
          )}
        </p>
        <p className="text-small text-muted">
          One answer is one question asked to one AI assistant
          {usage.aiChecks.answersPerCheck ? `; a full AI check uses ${usage.aiChecks.answersPerCheck.toLocaleString("en-IN")}` : ""}.{" "}
          {usage.aiChecks.resetsAt
            ? `Resets on ${fmtDay(usage.aiChecks.resetsAt)}.`
            : usage.plan.id === "trial"
              ? "These cover your whole free trial."
              : ""}
        </p>
      </div>
      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Cancel your subscription?"
        tone="warning"
        icon={<XCircle />}
        description={
          periodEnd
            ? `You won't be charged again. Everything keeps working until ${periodEnd}, then website checks and AI checks pause. Your reports are kept.`
            : "You won't be charged again. Everything keeps working until the end of this billing period, then website checks and AI checks pause. Your reports are kept."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
              Keep my plan
            </Button>
            <Button variant="danger" loading={busy} loadingText="Cancelling…" onClick={cancel}>
              Cancel at end of billing period
            </Button>
          </>
        }
      />
    </div>
  );
}
