"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, Mail, Sparkles } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/dashboard/client";
import { BRAND } from "@/lib/brand";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import type { PlanLimits } from "@/lib/types";
import { formatInr, type GstBreakdown } from "@/lib/billing/gst";
import { Badge, Button, LinkButton, Notice, Spinner, useToast } from "@/components/ui";
import { openRazorpaySubscription } from "./billing/razorpay-checkout";
import { SubscriptionSummary, type UsageResponse } from "./billing/subscription-card";

const POLL_MS = 3_000;
const POLL_MAX = 40; // ~2 minutes

type Phase = { kind: "idle" } | { kind: "activating"; planId: string } | { kind: "slow" } | { kind: "coming_soon" };

/** AI fields that @/lib/billing/plans adds to each plan (optional so plain PlanLimits still type-check). */
type PlanWithAi = PlanLimits & { aiAnswersPerMonth?: number; maxPromptsPerRun?: number; enginesPerCheck?: number };

/** "300 AI answers a month (25 questions × 3 AI assistants per check)"; trial: "1 AI check: 10 questions × 3 AI assistants". */
function aiLine(p: PlanWithAi): string {
  const answers = p.aiAnswersPerMonth ?? 0;
  const q = Math.min(p.maxPromptsPerRun ?? 0, p.maxTrackedPrompts);
  const e = p.enginesPerCheck ?? 0;
  const per = q > 0 && e > 0 ? `${q} questions × ${e} AI assistant${e === 1 ? "" : "s"}` : "";
  if (p.id === "trial") {
    const checks = q > 0 && e > 0 ? Math.floor(answers / (q * e)) : 0;
    return per ? `${checks} AI check${checks === 1 ? "" : "s"}: ${per}` : `${answers} AI answers`;
  }
  return `${answers.toLocaleString("en-IN")} AI answers a month${per ? ` (${per} per check)` : ""}`;
}

/** Price, GST and total the customer pays each month (shown before Razorpay opens). */
function PriceBreakdown({ price }: { price: GstBreakdown }) {
  const gst = price.gstPaise > 0;
  return (
    <dl className="space-y-1 rounded-xl border border-border bg-surface-2 p-3 text-small">
      <div className="flex justify-between gap-3">
        <dt className="text-fg-soft">Plan price</dt>
        <dd className="tabular-nums text-fg">{formatInr(price.basePaise)}</dd>
      </div>
      {gst && (
        <div className="flex justify-between gap-3">
          <dt className="text-fg-soft">GST {price.ratePercent}%</dt>
          <dd className="tabular-nums text-fg">{formatInr(price.gstPaise)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
        <dt className="text-fg">Total payable each month</dt>
        <dd className="tabular-nums text-fg">{formatInr(price.totalPaise)}</dd>
      </div>
    </dl>
  );
}

export function BillingPlans({
  plans,
  currentPlanId,
  canManage,
  prices = {},
  hasBillingDetails = true,
}: {
  plans: PlanLimits[];
  currentPlanId: string;
  canManage: boolean;
  /** Per plan id: price + GST for this customer (computed on the server; null for the free trial). */
  prices?: Record<string, GstBreakdown | null>;
  /** False when the organization hasn't entered billing details for GST invoices yet. */
  hasBillingDetails?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  /** Plan whose price breakdown is open, waiting for "Pay". */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [planId, setPlanId] = useState(currentPlanId);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = useSearchParams();
  const autoPlan = params.get("plan");
  const autoStarted = useRef(false);

  /** Server asks Razorpay directly whether this organization has a paid subscription (covers a missed webhook). */
  const syncWithRazorpay = useCallback(async (subscriptionId?: string) => {
    try {
      const r = await api<{ item: { status: string } }>("/api/billing/sync", { body: subscriptionId ? { subscriptionId } : {} });
      return r.item.status;
    } catch {
      return null;
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const r = await api<{ item: UsageResponse }>("/api/usage");
      setUsage(r.item);
      setPlanId(r.item.plan.id);
      return r.item;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // A payment that went through but never reached us is picked up here, on the next visit to Billing.
    void syncWithRazorpay().then((st) => (st === "activated" ? router.refresh() : undefined)).finally(() => void loadUsage());
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadUsage, syncWithRazorpay, router]);

  useEffect(() => setPlanId(currentPlanId), [currentPlanId]);

  /** Never trust the client callback: wait until the signed webhook has switched the plan on the server. */
  function waitForActivation(target: string, attempt = 0, subscriptionId?: string) {
    setPhase({ kind: "activating", planId: target });
    pollRef.current = setTimeout(async () => {
      // Every few seconds, also ask the server to check Razorpay directly, in case the webhook is slow or missing.
      if (attempt % 2 === 1) await syncWithRazorpay(subscriptionId);
      const u = await loadUsage();
      if (u && u.plan.id === target && u.access.active) {
        setPhase({ kind: "idle" });
        toast(`You're on ${u.plan.name}. Thanks!`, "success");
        router.refresh();
        return;
      }
      if (attempt + 1 >= POLL_MAX) {
        setPhase({ kind: "slow" });
        return;
      }
      waitForActivation(target, attempt + 1, subscriptionId);
    }, POLL_MS);
  }

  async function checkout(p: PlanLimits) {
    if (usage && !usage.billing.checkoutPlans.includes(p.id)) {
      setPhase({ kind: "coming_soon" });
      return;
    }
    setBusy(p.id);
    setPhase({ kind: "idle" });
    try {
      const r = await api<{ item: { subscriptionId: string; keyId?: string; shortUrl?: string | null } }>("/api/billing/checkout", {
        body: { planId: p.id },
      });
      if (!r.item.keyId) {
        if (r.item.shortUrl) window.location.assign(r.item.shortUrl);
        return;
      }
      try {
        await openRazorpaySubscription({
          keyId: r.item.keyId,
          subscriptionId: r.item.subscriptionId,
          name: BRAND.name,
          description: `${p.name} plan — monthly`,
          onSuccess: () => {
            setBusy(null);
            waitForActivation(p.id, 0, r.item.subscriptionId);
          },
          onDismiss: () => setBusy(null),
          onFailure: (msg) => {
            setBusy(null);
            toast(msg, "error");
          },
        });
      } catch (e) {
        // Checkout.js blocked (e.g. by an ad blocker): fall back to Razorpay's hosted page when we have one.
        if (r.item.shortUrl) {
          window.location.assign(r.item.shortUrl);
          return;
        }
        throw e;
      }
    } catch (e) {
      setBusy(null);
      if (e instanceof ApiClientError && e.code === "billing_not_configured") setPhase({ kind: "coming_soon" });
      else toast(errorMessage(e), "error");
    }
  }

  // Arriving from the pricing page with ?plan=agency (etc.): open that plan's price breakdown straight away.
  useEffect(() => {
    if (autoStarted.current || !autoPlan || !usage || !canManage) return;
    const target = plans.find((p) => p.id === autoPlan && p.id !== "trial");
    autoStarted.current = true;
    if (!target || usage.plan.id === target.id) return;
    // Show the price, GST and total first; Razorpay opens when they press Pay.
    setConfirmId(target.id);
  }, [autoPlan, usage, canManage, plans]);

  const currentIdx = plans.findIndex((p) => p.id === planId);
  const supportEmail = usage?.billing.supportEmail ?? BRAND.supportEmail;
  const activating = phase.kind === "activating";

  return (
    <div className="space-y-4">
      {usage && <SubscriptionSummary usage={usage} canManage={canManage} onChanged={() => void loadUsage()} />}
      {usage && !usage.access.active && (
        <Notice tone="danger" title="Checks are paused">
          {usage.access.message}
        </Notice>
      )}
      {!canManage && <Notice tone="neutral">Only the Owner or an Admin can change the plan. Ask them if you need more.</Notice>}
      {activating && (
        <Notice tone="success" title="Payment received — activating" icon={<Spinner />}>
          <span role="status">We&apos;re waiting for the payment provider to confirm. This usually takes a few seconds — you can stay on this page.</span>
        </Notice>
      )}
      {phase.kind === "slow" && (
        <Notice tone="info" title="Still activating">
          <span role="status">
            Your payment went through, but confirmation is taking longer than usual. Refresh this page in a few minutes. If your plan
            hasn&apos;t changed in an hour, email {supportEmail} and we&apos;ll sort it out.
          </span>
        </Notice>
      )}
      {phase.kind === "coming_soon" && (
        <Notice
          tone="info"
          title="Payments are coming soon"
          actions={
            <LinkButton href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Upgrade my ${BRAND.name} plan`)}`} size="sm" icon={<Mail />} external>
              Contact us to upgrade
            </LinkButton>
          }
        >
          Online payments aren&apos;t switched on yet. Contact us to upgrade and we&apos;ll set up your plan for you.
        </Notice>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(plans as PlanWithAi[]).map((p, i) => {
          const current = p.id === planId;
          const upgrade = currentIdx >= 0 && i > currentIdx;
          const features = [
            `${p.maxProjects} website${p.maxProjects === 1 ? "" : "s"}`,
            `${p.maxTrackedPrompts} customer ${p.maxTrackedPrompts === 1 ? "question" : "questions"}`,
            ...(p.aiAnswersPerMonth ? [aiLine(p)] : []),
            `${p.maxPagesPerCrawl.toLocaleString()} pages per website check`,
            `${p.seats} team seat${p.seats === 1 ? "" : "s"}`,
            `Check your website again every ${p.minScanIntervalDays === 1 ? "day" : `${p.minScanIntervalDays} days`}`,
            ...(p.competitorTracking ? ["Compare with competitors"] : []),
            ...(p.approvalPublishing ? ["Approved fixes go live on your site for you"] : []),
          ];
          return (
            <li
              key={p.id}
              className={clsx(
                "relative flex flex-col rounded-2xl border bg-surface p-5 shadow-card transition-shadow",
                current ? "border-primary ring-2 ring-primary/30" : "border-border hover:shadow-card-hover",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-h4 text-fg">{p.name}</h3>
                {current && (
                  <Badge tone="primary" variant="solid" size="sm">
                    Current plan
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-h2 tabular-nums text-fg">
                  {p.priceInrMonthly === null ? "Free" : `₹${p.priceInrMonthly.toLocaleString("en-IN")}`}
                </span>
                {p.priceInrMonthly !== null && (
                  <span className="text-small text-muted">{(prices[p.id]?.gstPaise ?? 0) > 0 ? "+ GST / month" : "/ month"}</span>
                )}
              </div>
              {p.id === "trial" && <p className="mt-1 text-xs text-muted">{TRIAL_DAYS} days to try everything</p>}
              <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4 text-small text-fg-soft">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              {p.id !== "trial" && !current && canManage && confirmId === p.id && (
                <div className="mt-5 space-y-3">
                  {prices[p.id] && <PriceBreakdown price={prices[p.id]!} />}
                  {!hasBillingDetails && (prices[p.id]?.gstPaise ?? 0) > 0 && (
                    <p className="text-xs text-muted">
                      Want your business name or GSTIN on the invoice? Add them under Billing details below before you pay.
                    </p>
                  )}
                  <Button
                    fullWidth
                    icon={<Sparkles />}
                    loading={busy === p.id}
                    loadingText="Opening checkout…"
                    disabled={(!!busy && busy !== p.id) || activating}
                    onClick={() => checkout(p)}
                  >
                    {prices[p.id] ? `Pay ${formatInr(prices[p.id]!.totalPaise)} a month` : "Continue to payment"}
                  </Button>
                  <Button fullWidth variant="ghost" disabled={busy === p.id} onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </div>
              )}
              {p.id !== "trial" && !current && canManage && confirmId !== p.id && (
                <Button
                  className="mt-5"
                  fullWidth
                  variant={upgrade ? "primary" : "secondary"}
                  icon={upgrade ? <Sparkles /> : undefined}
                  loading={busy === p.id}
                  loadingText="Opening checkout…"
                  disabled={!!busy || activating}
                  onClick={() => setConfirmId(p.id)}
                >
                  {upgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        AI answers reset on the 1st of each month (the free trial&apos;s answers cover the whole trial). Payments are processed securely by
        Razorpay; your plan changes as soon as the payment is confirmed.
      </p>
    </div>
  );
}
