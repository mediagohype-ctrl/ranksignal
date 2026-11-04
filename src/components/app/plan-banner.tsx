// Plan status banner for the app shell's single banner slot. Server-friendly: no hooks, no client state — pass
// the kind from pickBanner() and the data from getPlanBannerData (@/lib/billing/banner). The verify-email kind is
// rendered by <VerifyEmailBanner /> in the layout; this component renders the plan kinds.
import { CreditCard, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { fmtDate } from "@/lib/dashboard/format";
import type { BannerKind } from "@/lib/billing/banner";
import { trialDaysLeft } from "@/lib/billing/banner";
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

export interface PlanBannerAi {
  used: number;
  cap: number;
  left: number;
  resetsAt: DateLike;
}

export interface PlanBannerProps {
  kind: Exclude<BannerKind, "verify_email">;
  access: PlanBannerAccess;
  ai?: PlanBannerAi | null;
  /** Billing page link. */
  upgradeHref?: string;
  /** Hide upgrade buttons for members who can't change the plan. */
  canManageBilling?: boolean;
  className?: string;
  now?: Date;
  /** Viewer's time zone for dates (User.timeZone). */
  timeZone?: string | null;
}

function toDate(d: DateLike): Date | null {
  if (!d) return null;
  const v = d instanceof Date ? d : new Date(d);
  return Number.isNaN(v.getTime()) ? null : v;
}

export function PlanBanner({ kind, access, ai, upgradeHref = "/app/settings?tab=billing", canManageBilling = true, className, now = new Date(), timeZone }: PlanBannerProps) {
  const day = (d: Date) => fmtDate(d, { timeZone });
  const upgrade = (label = "See plans") =>
    canManageBilling ? (
      <LinkButton href={upgradeHref} size="sm" icon={<Sparkles />}>
        {label}
      </LinkButton>
    ) : null;
  const askAdmin = canManageBilling ? null : <span>Ask your workspace Owner or an Admin to choose a plan.</span>;
  let notice: React.ReactNode = null;

  if (kind === "blocked") {
    if (access.reason === "suspended") {
      notice = (
        <Notice tone="danger" title="This workspace is paused" actions={<LinkButton href={`mailto:${BRAND.supportEmail}`} size="sm" variant="secondary" external>Contact us</LinkButton>}>
          New website checks and AI checks are paused. Your reports are still here. Contact us to turn things back on.
        </Notice>
      );
    } else if (access.reason === "past_due") {
      notice = (
        <Notice tone="danger" title="Checks are paused — payment needed" actions={upgrade("Update billing")}>
          We couldn&apos;t take your last payment, and the grace period has ended. Your reports are still available. {askAdmin}
        </Notice>
      );
    } else {
      notice = (
        <Notice tone="danger" title={access.reason === "trial_expired" ? "Your free trial has ended" : "Your plan has ended"} actions={upgrade("Choose a plan")}>
          Choose a plan to keep running website checks and AI checks. Everything you&apos;ve set up and your past reports are kept. {askAdmin}
        </Notice>
      );
    }
  } else if (kind === "payment_due") {
    const grace = toDate(access.graceEndsAt);
    notice = (
      <Notice tone="warning" title="Payment didn't go through" icon={<CreditCard />} actions={upgrade("Update billing")}>
        Please update your payment details{grace ? ` before ${day(grace)}` : ""} so your checks don&apos;t pause. {askAdmin}
      </Notice>
    );
  } else if (kind === "trial_ending") {
    const end = toDate(access.trialEndsAt);
    const days = trialDaysLeft({ ...access, trialEndsAt: end }, now) ?? 0;
    notice = (
      <Notice tone="warning" title={days <= 1 ? "Your free trial ends today" : `Your free trial ends in ${days} days`} actions={upgrade("Choose a plan")}>
        {end ? `Your trial ends on ${day(end)}. ` : ""}Pick a plan to keep your website checks and AI checks running. {askAdmin}
      </Notice>
    );
  } else if (kind === "limit_reached" && ai) {
    const reset = toDate(ai.resetsAt);
    notice = (
      <Notice tone="warning" title="You've used all your AI answers" actions={upgrade("Upgrade")}>
        {reset
          ? `You've used all ${ai.cap.toLocaleString("en-IN")} AI answers this month. They reset on ${day(reset)}. Upgrade if you need more before then.`
          : `You've used the ${ai.cap.toLocaleString("en-IN")} AI answers in your free trial. Choose a plan to keep checking what AI says about you.`}{" "}
        {askAdmin}
      </Notice>
    );
  }

  if (!notice) return null;
  return <div className={["no-print", className].filter(Boolean).join(" ")}>{notice}</div>;
}
