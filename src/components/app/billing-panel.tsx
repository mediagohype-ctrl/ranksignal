"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Mail, Sparkles } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/dashboard/client";
import { BRAND } from "@/lib/brand";
import type { PlanLimits } from "@/lib/types";
import { Badge, Button, LinkButton, Notice, Spinner, useToast } from "@/components/ui";
import { openRazorpaySubscription } from "./billing/razorpay-checkout";
import { SubscriptionSummary, type UsageResponse } from "./billing/subscription-card";

const POLL_MS = 3_000;
const POLL_MAX = 40; // ~2 minutes

type Phase = { kind: "idle" } | { kind: "activating"; planId: string } | { kind: "slow" } | { kind: "coming_soon" };

/** Optional AI-check fields that @/lib/billing/plans adds to each plan at runtime. */
type PlanWithAi = PlanLimits & { maxVisibilityRunsPerMonth?: number; maxPromptsPerRun?: number };

export function BillingPlans({ plans, currentPlanId, canManage }: { plans: PlanLimits[]; currentPlanId: string; canManage: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [planId, setPlanId] = useState(currentPlanId);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    void loadUsage();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadUsage]);

  useEffect(() => setPlanId(currentPlanId), [currentPlanId]);

  /** Never trust the client callback: wait until the signed webhook has switched the plan on the server. */
  function waitForActivation(target: string, attempt = 0) {
    setPhase({ kind: "activating", planId: target });
    pollRef.current = setTimeout(async () => {
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
      waitForActivation(target, attempt + 1);
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
            waitForActivation(p.id);
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

  const currentIdx = plans.findIndex((p) => p.id === planId);
  const supportEmail = usage?.billing.supportEmail ?? BRAND.supportEmail;
  const activating = phase.kind === "activating";

  return (
    <div className="space-y-4">
      {usage && <SubscriptionSummary usage={usage} canManage={canManage} onChanged={() => void loadUsage()} />}
      {usage && !usage.access.active && (
        <Notice tone="danger" title="Scans are paused">
          {usage.access.message}
        </Notice>
      )}
      {!canManage && <Notice tone="neutral">Only workspace owners and admins can change the plan.</Notice>}
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
            `${p.maxTrackedPrompts} tracked questions`,
            ...(p.maxVisibilityRunsPerMonth
              ? [`${p.maxVisibilityRunsPerMonth} AI visibility checks a month${p.maxPromptsPerRun ? ` (up to ${p.maxPromptsPerRun} questions each)` : ""}`]
              : []),
            `${p.maxPagesPerCrawl.toLocaleString()} pages per scan`,
            `${p.monthlyCredits.toLocaleString()} credits a month`,
            `${p.seats} team seat${p.seats === 1 ? "" : "s"}`,
            `Rescan every ${p.minScanIntervalDays === 1 ? "day" : `${p.minScanIntervalDays} days`}`,
            ...(p.competitorTracking ? ["Competitor comparison"] : []),
            ...(p.approvalPublishing ? ["Publish approved fixes to your site"] : []),
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
                {p.priceInrMonthly !== null && <span className="text-small text-muted">/ month</span>}
              </div>
              {p.id === "trial" && <p className="mt-1 text-xs text-muted">7 days to try everything</p>}
              <ul className="mt-4 flex-1 space-y-2 border-t border-border pt-4 text-small text-fg-soft">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              {p.id !== "trial" && !current && canManage && (
                <Button
                  className="mt-5"
                  fullWidth
                  variant={upgrade ? "primary" : "secondary"}
                  icon={upgrade ? <Sparkles /> : undefined}
                  loading={busy === p.id}
                  loadingText="Opening checkout…"
                  disabled={(!!busy && busy !== p.id) || activating}
                  onClick={() => checkout(p)}
                >
                  {upgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Credits and AI checks reset at the start of each month. Payments are processed securely by Razorpay; your plan changes as soon as
        the payment is confirmed.
      </p>
    </div>
  );
}
