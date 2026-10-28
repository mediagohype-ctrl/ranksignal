"use client";
import { useState } from "react";
import { CalendarClock, CreditCard, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Badge, Button, Dialog, KeyValueList, Meter, useToast } from "@/components/ui";

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
  aiChecks: { used: number; limit: number; remaining: number; maxPromptsPerRun: number };
  billing: BillingInfo;
}

export function fmtDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
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
              Cancels at period end
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
          <CalendarClock size={18} aria-hidden className="text-muted" /> AI checks this month
        </h3>
        <Meter value={usage.aiChecks.used} max={Math.max(1, usage.aiChecks.limit)} label="AI visibility checks used" showValue />
        <p className="text-small text-muted">
          {usage.aiChecks.used} of {usage.aiChecks.limit} checks used · up to {usage.aiChecks.maxPromptsPerRun} questions per check.
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
            ? `You won't be charged again. Everything keeps working until ${periodEnd}, then scans and AI checks pause. Your reports are kept.`
            : "You won't be charged again. Everything keeps working until the end of this billing period, then scans and AI checks pause."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
              Keep my plan
            </Button>
            <Button variant="danger" loading={busy} loadingText="Cancelling…" onClick={cancel}>
              Cancel at period end
            </Button>
          </>
        }
      />
    </div>
  );
}
