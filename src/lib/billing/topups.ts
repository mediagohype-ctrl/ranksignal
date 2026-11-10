// One-time AI-answer top-up packs (pure config, no DB). Customers who run out of AI answers can buy extra answers
// once — NOT autopay, and the plan does not change. Prices are BEFORE GST, in paise (GST is added at checkout by
// priceWithGst in ./gst.ts).
//
// Rules:
//   - The plan's monthly answers are used first; extra answers only after those run out (oldest pack first).
//   - Each pack is valid for TOPUP_VALIDITY_MONTHS from purchase; whatever is left after that expires.
//   - A pack's price per answer should not be lower than the Starter plan's price per answer, so a plan stays the
//     better deal (guarded by tests/billing/topups.test.ts; owner-approved exceptions are listed there).
// Customer word is "AI answers" (never credits/tokens).

export const TOPUP_VALIDITY_MONTHS = 12;

export const TOPUP_PACK_IDS = ["answers_35", "answers_100", "answers_500", "answers_2000", "answers_test"] as const;
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

// Owner's prices (2026-11-10). Smallest pack first: top-ups start "from ₹250 + GST".
// NOTE: at Starter = ₹1,999 / 300 answers (≈ ₹6.66 per answer), the 500 pack (₹6.00) and the 2,000 pack (≈ ₹5.00)
// are CHEAPER per answer than Starter — an owner-approved bulk discount, listed in the guard test. Revisit if
// customers start buying packs instead of upgrading.
export const TOPUP_PACKS: readonly TopUpPackConfig[] = [
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

/** Lowest pack price before GST, in paise ("from ₹250 + GST"). */
export const TOPUP_FROM_PAISE = Math.min(...TOPUP_PACKS.map((p) => p.pricePaise));

export function isTopUpPackId(id: unknown): id is TopUpPackId {
  return typeof id === "string" && (TOPUP_PACK_IDS as readonly string[]).includes(id);
}

export function getTopUpPack(id: string): TopUpPackConfig | null {
  return [...TOPUP_PACKS, TOPUP_TEST_PACK].find((p) => p.id === id) ?? null;
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
  const n = (x: number) => Math.max(0, Math.floor(x)).toLocaleString("en-IN");
  const base = `${n(a.monthlyLeft)} of ${n(a.cap)}${trial ? "" : " monthly"}`;
  return a.extraLeft > 0 ? `${base} + ${n(a.extraLeft)} extra` : `${n(a.monthlyLeft)} of ${n(a.cap)}`;
}
