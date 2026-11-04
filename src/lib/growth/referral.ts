// Referral (brief §9): one free month for each paying referral.
//   - Organization.referralCode is created lazily (8 chars, no look-alike characters) → share link /signup?ref=CODE
//   - sign-up with a valid code sets the new organization's referredById (attachReferral)
//   - when the referred organization's paid subscription becomes active, the Razorpay webhook calls
//     applyReferralReward(referredOrgId). The credit is recorded once per referred org as
//     SentMessage { kind: "referral_reward", key: referredOrgId, organizationId: referrerId } + an AuditLog row.
//     If the referrer is still on the free trial, the trial is extended by 30 days right away. For a paying
//     referrer, Razorpay owns the billing period (a local currentPeriodEnd change would be overwritten on the next
//     charge), so staff get an alert to apply the free month in Razorpay; the credit count is shown in the app.
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { appLink, referralRewardTemplate } from "@/lib/email/templates";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { claimOnce, isUniqueViolation } from "./once";
import { verifiedRecipients } from "./deliver";

export const REFERRAL_REWARD_KIND = "referral_reward";
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_FREE_DAYS = 30;
/** No 0/O or 1/I/L: codes get read out loud and typed from WhatsApp. */
export const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);
const DAY_MS = 24 * 60 * 60 * 1000;

export function generateReferralCode(rand: (max: number) => number = randomInt): string {
  let s = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) s += REFERRAL_ALPHABET[rand(REFERRAL_ALPHABET.length)];
  return s;
}

/** Upper-cased valid code, or null. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

/** `ref` query param from a URL (e.g. the sign-up page's Referer), or null. */
export function referralCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeReferralCode(new URL(url).searchParams.get("ref"));
  } catch {
    return null;
  }
}

export function referralLink(code: string): string {
  return appLink(`/signup?ref=${encodeURIComponent(code)}`);
}

/** The org's code, creating it on first use (retries on the rare unique collision). */
export async function ensureReferralCode(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { referralCode: true } });
  if (!org) throw new Error("organization not found");
  if (org.referralCode) return org.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.organization.updateMany({ where: { id: organizationId, referralCode: null }, data: { referralCode: generateReferralCode() } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      continue; // collision with another org's code: try a new one
    }
    const now = await db.organization.findUnique({ where: { id: organizationId }, select: { referralCode: true } });
    if (now?.referralCode) return now.referralCode; // ours, or a concurrent request's
  }
  throw new Error("could not create a referral code");
}

/** Link a new organization to its referrer. No-op for unknown codes, self-referral or an already-set referrer. */
export async function attachReferral(newOrgId: string, rawCode: unknown): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return false;
  const referrer = await db.organization.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (!referrer || referrer.id === newOrgId) return false;
  const r = await db.organization.updateMany({ where: { id: newOrgId, referredById: null }, data: { referredById: referrer.id } });
  return r.count === 1;
}

export interface ReferralSummary {
  code: string;
  link: string;
  /** Organizations that signed up with the link. */
  signedUp: number;
  /** Of those, how many became paying customers (= free months earned). */
  paying: number;
  freeMonthsEarned: number;
}

export async function referralSummary(organizationId: string): Promise<ReferralSummary> {
  const code = await ensureReferralCode(organizationId);
  const [signedUp, rewards] = await Promise.all([
    db.organization.count({ where: { referredById: organizationId } }),
    db.sentMessage.count({ where: { kind: REFERRAL_REWARD_KIND, organizationId } }),
  ]);
  return { code, link: referralLink(code), signedUp, paying: rewards, freeMonthsEarned: rewards };
}

export type ReferralRewardResult =
  | { status: "no_referrer" }
  | { status: "already_rewarded" }
  | { status: "trial_extended"; referrerId: string }
  | { status: "credit_recorded"; referrerId: string };

/**
 * Reward the referrer of `referredOrgId`. Call when the referred org's paid subscription becomes active; safe to call
 * on every activation/charge (idempotent per referred organization).
 */
export async function applyReferralReward(referredOrgId: string): Promise<ReferralRewardResult> {
  const referred = await db.organization.findUnique({
    where: { id: referredOrgId },
    select: { id: true, name: true, planId: true, referredById: true },
  });
  if (!referred?.referredById || referred.planId === "trial" || referred.referredById === referred.id) return { status: "no_referrer" };
  const referrer = await db.organization.findUnique({ where: { id: referred.referredById }, select: { id: true, name: true, planId: true } });
  if (!referrer) return { status: "no_referrer" };
  if (!(await claimOnce({ kind: REFERRAL_REWARD_KIND, key: referred.id, organizationId: referrer.id, channel: "email" }))) {
    return { status: "already_rewarded" };
  }

  let extended = false;
  if (referrer.planId === "trial") {
    const trial = await db.subscription.findFirst({
      where: { organizationId: referrer.id, status: "trialing" },
      orderBy: { createdAt: "desc" },
      select: { id: true, trialEndsAt: true },
    });
    if (trial) {
      const from = Math.max(trial.trialEndsAt?.getTime() ?? Date.now(), Date.now());
      const until = new Date(from + REFERRAL_FREE_DAYS * DAY_MS);
      await db.subscription.update({ where: { id: trial.id }, data: { trialEndsAt: until, currentPeriodEnd: until } });
      extended = true;
    }
  }

  await db.auditLog
    .create({
      data: {
        organizationId: referrer.id,
        actorType: "system",
        action: "referral.reward",
        resourceType: "organization",
        resourceId: referred.id,
        after: { freeDays: REFERRAL_FREE_DAYS, applied: extended ? "trial_extended" : "pending_billing_credit" },
      },
    })
    .catch(() => undefined);

  if (!extended) {
    await sendStaffAlert({
      kind: "staff_referral_reward",
      key: referred.id,
      organizationId: referrer.id,
      subject: `Apply 1 free month: ${referrer.name}`,
      text: `${referrer.name} (${referrer.id}) referred ${referred.name} (${referred.id}), who just started paying. Give ${referrer.name} one free month in Razorpay (skip or discount the next charge).`,
    }).catch(() => undefined);
  }

  if (isEmailConfigured()) {
    const content = referralRewardTemplate({ referredName: referred.name, trialExtended: extended, link: appLink("/app/settings/billing") });
    const to = await verifiedRecipients(referrer.id, ["owner"]).catch(() => [] as string[]);
    for (const addr of to) {
      await sendEmail({ to: addr, subject: content.subject, html: content.html, text: content.text }).catch(() => undefined);
    }
  }
  return extended ? { status: "trial_extended", referrerId: referrer.id } : { status: "credit_recorded", referrerId: referrer.id };
}
