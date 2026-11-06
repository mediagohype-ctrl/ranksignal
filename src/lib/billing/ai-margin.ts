// Profit guard: the most AI spend one workspace may cause in a month is a share of what it pays us.
//
//   monthly AI budget = (plan price + done-for-you tier price) × AI_COST_SHARE      (default 30%)
//   free trial        = TRIAL_AI_BUDGET_INR                                          (default ₹150, acquisition cost)
//
// Enforced as a hard cap in src/lib/billing/ai-budget.ts (alongside the daily caps). The rest of the price pays
// for servers, marketing, payment fees and profit. Customers never see this number — they see AI answers a month.
import { getPlanWithAiLimits } from "./plans";
import { SERVICE_TIER_PRICES_INR, isServiceTier, usdInrRate } from "@/lib/admin/money";

export const DEFAULT_AI_COST_SHARE = 0.3;
export const DEFAULT_TRIAL_AI_BUDGET_INR = 150;

/** AI_COST_SHARE: fraction of the price that may go to AI providers (0 < x ≤ 1). */
export function aiCostShare(): number {
  const n = Number(process.env.AI_COST_SHARE);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_AI_COST_SHARE;
}

function trialBudgetInr(): number {
  const n = Number(process.env.TRIAL_AI_BUDGET_INR);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TRIAL_AI_BUDGET_INR;
}

/** What the workspace pays per month in INR (plan + done-for-you tier). 0 for the free trial. */
export function monthlyPriceInr(planId: string, serviceTier?: string | null): number {
  const plan = getPlanWithAiLimits(planId).priceInrMonthly ?? 0;
  const tier = isServiceTier(serviceTier) ? SERVICE_TIER_PRICES_INR[serviceTier] : 0;
  return plan + tier;
}

/** Most AI spend (INR) this workspace may cause per calendar month. */
export function monthlyAiBudgetInr(planId: string, serviceTier?: string | null): number {
  const price = monthlyPriceInr(planId, serviceTier);
  return price > 0 ? Math.round(price * aiCostShare()) : trialBudgetInr();
}

/** Same, in micro-USD (what providers bill and the usage ledger records). */
export function monthlyAiBudgetMicros(planId: string, serviceTier?: string | null): number {
  return Math.round((monthlyAiBudgetInr(planId, serviceTier) / usdInrRate()) * 1_000_000);
}
