// Plan status banner for the app shell. Server-friendly: no hooks, no client state — pass data in as props
// (see getPlanBannerData in @/lib/billing/banner). Renders nothing when there is nothing to say.
import { CreditCard, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { LinkButton, Notice } from "@/components/ui";

type DateLike = Date | string | null | undefined;

export interface PlanBannerAccess {
  active: boolean;
  reason?: "trial_expired" | "past_due" | "cancelled" | "suspended";
  planId: string;
  trialEndsAt?: DateLike;
  graceEndsAt?: DateLike;
  currentPeriodEnd?: DateLike;
}

export interface PlanBannerUsage {
  creditsUsed: number;
  creditsLimit: number;
  aiChecksUsed?: number;
  aiChecksLimit?: number;
}

export interface PlanBannerProps {
  access: PlanBannerAccess;
  usage: PlanBannerUsage;
  /** Billing page link. */
  upgradeHref?: string;
  /** Hide upgrade buttons for members who can't change the plan. */
  canManageBilling?: boolean;
  className?: string;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_WARN = 0.8;

function toDate(d: DateLike): Date | null {
  if (!d) return null;
  const v = d instanceof Date ? d : new Date(d);
  return Number.isNaN(v.getTime()) ? null : v;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function PlanBanner({ access, usage, upgradeHref = "/app/settings?tab=billing", canManageBilling = true, className, now = new Date() }: PlanBannerProps) {
  const upgrade = (label = "See plans") =>
    canManageBilling ? (
      <LinkButton href={upgradeHref} size="sm" icon={<Sparkles />}>
        {label}
      </LinkButton>
    ) : null;
  const askAdmin = canManageBilling ? null : <span>Ask a workspace owner or admin to choose a plan.</span>;
  const notices: React.ReactNode[] = [];

  if (!access.active) {
    if (access.reason === "suspended") {
      notices.push(
        <Notice key="state" tone="danger" title="This workspace is suspended" actions={<LinkButton href={`mailto:${BRAND.supportEmail}`} size="sm" variant="secondary" external>Contact support</LinkButton>}>
          New scans and AI checks are paused. Your reports are still available.
        </Notice>,
      );
    } else if (access.reason === "past_due") {
      notices.push(
        <Notice key="state" tone="danger" title="Scans are paused — payment needed" actions={upgrade("Update billing")}>
          We couldn&apos;t take your last payment, and the grace period has ended. Your reports are still available. {askAdmin}
        </Notice>,
      );
    } else {
      notices.push(
        <Notice
          key="state"
          tone="danger"
          title={access.reason === "trial_expired" ? "Your free trial has ended" : "Your plan has ended"}
          actions={upgrade("Choose a plan")}
        >
          Choose a plan to keep running scans and AI checks. Everything you&apos;ve set up and your past reports are kept. {askAdmin}
        </Notice>,
      );
    }
  } else if (access.reason === "past_due") {
    const grace = toDate(access.graceEndsAt);
    notices.push(
      <Notice key="state" tone="warning" title="Payment didn't go through" icon={<CreditCard />} actions={upgrade("Update billing")}>
        Please update your payment details{grace ? ` before ${fmtDate(grace)}` : ""} to avoid a pause in scans. {askAdmin}
      </Notice>,
    );
  } else if (access.reason === "cancelled") {
    const end = toDate(access.currentPeriodEnd);
    notices.push(
      <Notice key="state" tone="info" title="Your plan is cancelled" actions={upgrade("See plans")}>
        Everything keeps working{end ? ` until ${fmtDate(end)}` : " until the end of this billing period"}.
      </Notice>,
    );
  } else if (access.planId === "trial") {
    const end = toDate(access.trialEndsAt);
    if (end) {
      const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
      notices.push(
        <Notice key="state" tone={days <= 2 ? "warning" : "tip"} title={days <= 1 ? "Your free trial ends today" : `${days} days left in your free trial`} actions={upgrade("Choose a plan")}>
          Your trial ends on {fmtDate(end)}. Pick a plan any time to keep your scans and AI checks running.
        </Notice>,
      );
    }
  }

  // Usage ≥ 80% (only meaningful while the plan is active).
  if (access.active) {
    const parts: string[] = [];
    if (usage.creditsLimit > 0 && usage.creditsUsed / usage.creditsLimit >= USAGE_WARN) {
      parts.push(`${Math.min(100, Math.round((usage.creditsUsed / usage.creditsLimit) * 100))}% of this month's credits`);
    }
    if (usage.aiChecksLimit && usage.aiChecksUsed !== undefined && usage.aiChecksUsed / usage.aiChecksLimit >= USAGE_WARN) {
      parts.push(`${usage.aiChecksUsed} of ${usage.aiChecksLimit} AI checks this month`);
    }
    if (parts.length) {
      notices.push(
        <Notice key="usage" tone="warning" title="You're close to your plan limits" actions={upgrade("Upgrade")}>
          You&apos;ve used {parts.join(" and ")}. Limits reset at the start of each month (UTC).
        </Notice>,
      );
    }
  }

  if (notices.length === 0) return null;
  return <div className={["no-print space-y-3", className].filter(Boolean).join(" ")}>{notices}</div>;
}
