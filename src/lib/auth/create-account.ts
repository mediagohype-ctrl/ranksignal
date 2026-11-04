// Creates the workspace a new owner lands in (organization + owner membership + trial subscription). Shared by
// email sign-up and "Continue with Google" so both paths stay identical. Runs inside the caller's transaction.
import type { Prisma } from "@prisma/client";
import { TRIAL_DAYS } from "@/lib/billing/plans";

export interface NewWorkspaceInput {
  userId: string;
  /** Sign-up no longer asks for a business name; pass placeholderOrgName(email). Setup renames it from the facts. */
  organizationName: string;
  /** Referral code from ?ref= (preserved through sign-up). Unknown codes are ignored. */
  ref?: string | null;
}

export function trialEndsAt(now = Date.now()): Date {
  return new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** Referral codes are short URL-safe tokens; anything else is ignored rather than looked up. */
export function cleanRef(ref: unknown): string | null {
  return typeof ref === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(ref.trim()) ? ref.trim().toUpperCase() : null;
}

export async function createOwnerWorkspace(tx: Prisma.TransactionClient, input: NewWorkspaceInput) {
  const ends = trialEndsAt();
  const code = cleanRef(input.ref);
  const referrer = code ? await tx.organization.findUnique({ where: { referralCode: code }, select: { id: true } }).catch(() => null) : null;
  const org = await tx.organization.create({
    data: {
      name: input.organizationName.slice(0, 120),
      planId: "trial",
      status: "active",
      ...(referrer ? { referredById: referrer.id } : {}),
    },
  });
  await tx.membership.create({ data: { userId: input.userId, organizationId: org.id, role: "owner", status: "active" } });
  await tx.subscription.create({
    data: { organizationId: org.id, provider: "razorpay", planId: "trial", status: "trialing", trialEndsAt: ends, currentPeriodStart: new Date(), currentPeriodEnd: ends },
  });
  return org;
}
