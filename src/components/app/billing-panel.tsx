"use client";
import { useState } from "react";
import clsx from "clsx";
import { Check, Sparkles } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { PlanLimits } from "@/lib/types";
import { Badge, Button, Notice, useToast } from "@/components/ui";

export function BillingPlans({ plans, currentPlanId, canManage }: { plans: PlanLimits[]; currentPlanId: string; canManage: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function checkout(planId: string) {
    setBusy(planId);
    setNotice(null);
    try {
      const r = await api<{ item: { shortUrl?: string | null } }>("/api/billing/checkout", { body: { planId } });
      if (r.item.shortUrl) {
        window.location.assign(r.item.shortUrl);
        return;
      }
      setNotice("Checkout started. Your plan will update as soon as the payment provider confirms it.");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const currentIdx = plans.findIndex((p) => p.id === currentPlanId);

  return (
    <div className="space-y-4">
      {!canManage && (
        <Notice tone="neutral">Only workspace owners and admins can change the plan.</Notice>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p, i) => {
          const current = p.id === currentPlanId;
          const upgrade = currentIdx >= 0 && i > currentIdx;
          const features = [
            `${p.maxProjects} website${p.maxProjects === 1 ? "" : "s"}`,
            `${p.maxTrackedPrompts} tracked questions`,
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
                  disabled={!!busy && busy !== p.id}
                  onClick={() => checkout(p.id)}
                >
                  {upgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {notice && (
        <Notice tone="success" className="animate-fade-in">
          <span role="status">{notice}</span>
        </Notice>
      )}
      <p className="text-xs text-muted">Credits reset at the start of each billing month.</p>
    </div>
  );
}
