// One-time AI-answer top-up packs (pure config, no DB). Customers who run out of AI answers can buy extra answers
// once — NOT autopay, and the plan does not change. Prices are BEFORE GST, in paise (GST is added at checkout by
// priceWithGst in ./gst.ts).
//
// Rules:
//   - The plan's monthly answers are used first; extra answers only after those run out (oldest pack first).
//   - Each pack is valid for TOPUP_VALIDITY_MONTHS from purchase; whatever is left after that expires.
//   - Packs are sold in whole AI checks. Their price per answer may sit below the plan's (see the notes at
//     TOPUP_PACKS); the list and the price floor are guarded by tests/billing/topups.test.ts — changing a price is
//     an owner decision.
// Customer words are "AI checks" and "AI answers" (never credits/tokens).
import { answersPerCheck } from "./plans";

export const TOPUP_VALIDITY_MONTHS = 12;

export const TOPUP_PACK_IDS = ["checks_1", "checks_4", "answers_35", "answers_100", "answers_500", "answers_2000", "answers_test"] as const;
export type TopUpPackId = (typeof TOPUP_PACK_IDS)[number];

export interface TopUpPackConfig {
  id: TopUpPackId;
  /** Extra AI answers in the pack. */
  answers: number;
  /** Price before GST, in paise. */
  pricePaise: number;
  /** Short name for the dialog and invoices. */
  name: string;
}

/** Packs are sized in whole AI checks of the plan we sell: Do it myself (25 questions × 3 AI tools = 75 answers). */
export const TOPUP_CHECK_ANSWERS = answersPerCheck("starter");

const num = (x: number) => Math.max(0, Math.floor(x)).toLocaleString("en-IN");

/**
 * How a pack is named for a workspace: in checks first when it is a whole number of that plan's checks
 * ("1 extra AI check (75 answers)"), in answers otherwise ("75 extra AI answers" on a plan whose check is bigger).
 * `perCheck` comes from answersPerCheck(planId) in ./plans.
 */
export function packLabelFor(answers: number, perCheck: number): string {
  const checks = perCheck > 0 && answers > 0 && answers % perCheck === 0 ? answers / perCheck : 0;
  if (checks >= 1) return `${num(checks)} extra AI ${checks === 1 ? "check" : "checks"} (${num(answers)} answers)`;
  return `${num(answers)} extra AI answers`;
}

/** Full AI checks a number of answers covers ("225 answers = 3 full checks"). */
export function fullChecksIn(answers: number, perCheck: number): number {
  return perCheck > 0 ? Math.floor(Math.max(0, answers) / perCheck) : 0;
}

// Packs on sale (app audit 15 Nov 2026, Fix 28): whole AI checks, so the smallest pack always runs one full check
// (the old 35-answer pack could not). Prices are the audit's, before GST. Smallest first: "from ₹499 + GST".
//   1 check  =  75 answers · ₹499   → ₹6.65 per answer (the plan itself: ₹1,999 / 300 = ₹6.66 per answer)
//   4 checks = 300 answers · ₹1,699 → ₹5.66 per answer (bulk discount; above the ₹5.00 of the old 2,000 pack)
// Profit guard (ai-margin.ts topUpAiBudgetMicros): AI spend allowed for bought answers = AI_COST_SHARE (30%) of the
// pack price → ₹149.70 per check on the small pack, ₹127.43 per check on the 4-check pack (₹2.00 / ₹1.70 per
// answer; the old packs allowed ₹1.50–₹2.14). NOTE: the 4-check pack (₹1,699 for 300 answers, valid 12 months) is
// cheaper than a month of the plan (₹1,999 for 300 answers) — packs can only be used while a plan is active, but
// revisit if customers start buying packs instead of staying subscribed.
export const TOPUP_PACKS: readonly TopUpPackConfig[] = [
  { id: "checks_1", answers: TOPUP_CHECK_ANSWERS, pricePaise: 499_00, name: packLabelFor(TOPUP_CHECK_ANSWERS, TOPUP_CHECK_ANSWERS) },
  { id: "checks_4", answers: 4 * TOPUP_CHECK_ANSWERS, pricePaise: 1_699_00, name: packLabelFor(4 * TOPUP_CHECK_ANSWERS, TOPUP_CHECK_ANSWERS) },
];

/**
 * Packs sold until 15 Nov 2026 (owner's prices of 10 Nov). NOT on sale any more, but customers who bought one keep
 * it: balance, settlement and invoices read the answers and price from the stored order / pack row, and getTopUpPack
 * still resolves the name for the purchase history.
 */
export const LEGACY_TOPUP_PACKS: readonly TopUpPackConfig[] = [
  { id: "answers_35", answers: 35, pricePaise: 250_00, name: "35 extra AI answers" },
  { id: "answers_100", answers: 100, pricePaise: 699_00, name: "100 extra AI answers" },
  { id: "answers_500", answers: 500, pricePaise: 2_999_00, name: "500 extra AI answers" },
  { id: "answers_2000", answers: 2_000, pricePaise: 9_999_00, name: "2,000 extra AI answers" },
];

/**
 * TEMPORARY owner test pack: ₹10 for 5 answers, to try a real Razorpay payment end to end. Offered ONLY while the server
 * env TOPUP_TEST_PACK="true" (remove the env line, or set it to false, to hide it). It is never part of TOPUP_PACKS or
 * the "from ₹…" price; getTopUpPack still knows it so a paid test order is always granted and invoiced.
 */
export const TOPUP_TEST_PACK: TopUpPackConfig = { id: "answers_test", answers: 5, pricePaise: 10_00, name: "Test pack: 5 extra AI answers" };

export function topUpTestPackEnabled(): boolean {
  return process.env.TOPUP_TEST_PACK?.trim().toLowerCase() === "true";
}

/** Packs shown in the dialog and accepted at checkout (the test pack first, only while enabled). */
export function offeredTopUpPacks(): readonly TopUpPackConfig[] {
  return topUpTestPackEnabled() ? [TOPUP_TEST_PACK, ...TOPUP_PACKS] : TOPUP_PACKS;
}

/** Lowest pack price before GST, in paise ("from ₹499 + GST"). */
export const TOPUP_FROM_PAISE = Math.min(...TOPUP_PACKS.map((p) => p.pricePaise));

export function isTopUpPackId(id: unknown): id is TopUpPackId {
  return typeof id === "string" && (TOPUP_PACK_IDS as readonly string[]).includes(id);
}

/** Any pack ever sold (on sale, legacy, test) — for names in history and invoices. Checkout uses offeredTopUpPacks(). */
export function getTopUpPack(id: string): TopUpPackConfig | null {
  return [...TOPUP_PACKS, ...LEGACY_TOPUP_PACKS, TOPUP_TEST_PACK].find((p) => p.id === id) ?? null;
}

/** Price per answer before GST, in paise (may be fractional). */
export function pricePerAnswerPaise(p: Pick<TopUpPackConfig, "answers" | "pricePaise">): number {
  return p.answers > 0 ? p.pricePaise / p.answers : Infinity;
}

/** When a pack bought at `purchasedAt` expires: the same moment TOPUP_VALIDITY_MONTHS later (UTC; clamps 31st → 30th). */
export function topUpExpiry(purchasedAt: Date): Date {
  const d = new Date(purchasedAt.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + TOPUP_VALIDITY_MONTHS);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Customer copy for what is left: "820 of 1,200 monthly + 400 extra", "820 of 1,200" without extra answers.
 * `monthlyLeft`/`cap` are the plan's answers; `extraLeft` the bought ones.
 */
export function answersLeftLabel(a: { monthlyLeft: number; cap: number; extraLeft: number }, trial = false): string {
  const base = `${num(a.monthlyLeft)} of ${num(a.cap)}${trial ? "" : " monthly"}`;
  return a.extraLeft > 0 ? `${base} + ${num(a.extraLeft)} extra` : `${num(a.monthlyLeft)} of ${num(a.cap)}`;
}
