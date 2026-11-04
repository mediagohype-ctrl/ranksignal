// The app shell's ONE banner slot (brief rule 6: at most one banner). pickBanner is the pure priority rule;
// getPlanBannerData loads what it needs in a server component (app layout).
//   1. blocked        — trial ended / plan ended / payment grace over / suspended (a dead end otherwise)
//   2. verify_email   — email address not confirmed yet
//   3. payment_due    — last payment failed, still inside the grace period
//   4. trial_ending   — free trial ends within TRIAL_ENDING_DAYS
//   5. limit_reached  — AI answers used up for this month (with the reset date + Upgrade)
import { getOrgAccess, type OrgAccess } from "./access";
import { getAiAllowance, type AiAllowance } from "./allowance";

export const TRIAL_ENDING_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BannerKind = "blocked" | "verify_email" | "payment_due" | "trial_ending" | "limit_reached";

export interface BannerInput {
  access: Pick<OrgAccess, "active" | "reason" | "planId" | "trialEndsAt">;
  ai: Pick<AiAllowance, "cap" | "left"> | null;
  /** null/undefined = unknown (don't nag). */
  emailVerified?: boolean | null;
  /** Staff in support mode never get the customer's verify-email banner. */
  staffMode?: boolean;
  now?: Date;
}

/** Days left in the trial (rounded up), or null when not on a trial with an end date. */
export function trialDaysLeft(access: BannerInput["access"], now = new Date()): number | null {
  if (access.planId !== "trial" || !access.trialEndsAt) return null;
  const end = new Date(access.trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS));
}

/** Which single banner to show (null = none). Pure. */
export function pickBanner(i: BannerInput): BannerKind | null {
  const now = i.now ?? new Date();
  if (!i.access.active) return "blocked";
  if (i.emailVerified === false && !i.staffMode) return "verify_email";
  if (i.access.reason === "past_due") return "payment_due";
  const days = trialDaysLeft(i.access, now);
  if (days !== null && days <= TRIAL_ENDING_DAYS) return "trial_ending";
  if (i.ai && i.ai.cap > 0 && i.ai.left <= 0) return "limit_reached";
  return null;
}

export async function getPlanBannerData(orgId: string) {
  const [access, ai] = await Promise.all([getOrgAccess(orgId), getAiAllowance(orgId).catch(() => null)]);
  return { access, ai };
}
