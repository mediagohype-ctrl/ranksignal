import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH, UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { readInviteToken } from "@/lib/auth/invite";
import { isDisposableEmail, passwordPolicyError } from "@/lib/security/email-policy";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
  name: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(120),
  turnstileToken: z.string().max(2048).optional(),
  /** Signed invitation token (from /accept-invite). Required to create the account for an invited email. */
  inviteToken: z.string().min(10).max(4096).optional(),
});

/**
 * Same answer whether the email belongs to a real account or to a pending invitation, so sign-up can't be used
 * to probe which emails are registered beyond "can't use this one" (and it points real users to sign in).
 */
const EMAIL_UNAVAILABLE =
  "We couldn't create an account with this email. If you already have an account, sign in instead. If you were invited to a workspace, open the link in your invitation email.";

/**
 * A placeholder user (created when someone is invited) can only be claimed with that invitation's signed token:
 * the token was emailed to the address, so presenting it proves the person controls the inbox. Without it anyone
 * could register the invited email, set a password and walk into the inviting workspace.
 */
async function inviteProvesInbox(token: string | undefined, userId: string, email: string): Promise<boolean> {
  if (!token) return false;
  const invite = await readInviteToken(token);
  if (!invite || invite.email !== email) return false;
  const m = await db.membership.findUnique({ where: { id: invite.membershipId }, select: { userId: true, status: true } });
  return Boolean(m && m.userId === userId && m.status === "invited");
}

function fieldError(field: string, message: string, code = "validation_error"): HttpError {
  return new HttpError(400, code, message, { fieldErrors: { [field]: [message] } });
}

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  if (!checkRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many sign-up attempts. Try again later.");
  }
  const input = await parseBody(req, schema);
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "Please complete the security check and try again.", { captchaRequired: true });
  }
  if (isDisposableEmail(input.email)) {
    throw fieldError("email", "Please use a permanent work email address — temporary inboxes can't receive reports.", "disposable_email");
  }
  const policy = passwordPolicyError(input.password, input.email);
  if (policy) throw fieldError("password", policy);

  const passwordHash = await hashPassword(input.password);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const existing = await db.user.findUnique({ where: { email: input.email } });
  // Real accounts may not be re-registered; placeholder (invited) users only with the matching invite token.
  if (existing && (existing.passwordHash !== UNUSABLE_PASSWORD || !(await inviteProvesInbox(input.inviteToken, existing.id, input.email)))) {
    throw new HttpError(409, "email_unavailable", EMAIL_UNAVAILABLE, { signInHint: true });
  }

  const createAccount = () => db.$transaction(async (tx) => {
    const user = existing
      ? // Compare-and-swap on the placeholder hash so two concurrent claims can't both succeed.
        await tx.user
          .updateMany({ where: { id: existing.id, passwordHash: UNUSABLE_PASSWORD }, data: { passwordHash, name: input.name, emailVerified: true } })
          .then(async (r) => {
            if (r.count !== 1) throw new HttpError(409, "email_unavailable", EMAIL_UNAVAILABLE, { signInHint: true });
            return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
          })
      : // New accounts start unverified; invitations for this email only activate via the invite link.
        await tx.user.create({ data: { email: input.email, name: input.name, passwordHash, emailVerified: false } });
    const org = await tx.organization.create({ data: { name: input.organizationName, planId: "trial", status: "active" } });
    await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner", status: "active" } });
    await tx.subscription.create({
      data: { organizationId: org.id, provider: "razorpay", planId: "trial", status: "trialing", trialEndsAt, currentPeriodStart: new Date(), currentPeriodEnd: trialEndsAt },
    });
    return { user, org };
  });
  const { user, org } = await createAccount().catch((e: unknown) => {
    // Concurrent sign-up with the same email: unique constraint on User.email.
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      throw new HttpError(409, "email_unavailable", EMAIL_UNAVAILABLE, { signInHint: true });
    }
    throw e;
  });

  await writeAuditLog({ organizationId: org.id, actorId: user.id, action: "auth.signup", resourceType: "user", resourceId: user.id, ip });
  await setSessionCookie({ userId: user.id, email: user.email, organizationId: org.id, role: "owner" });
  if (!user.emailVerified) {
    await sendVerificationEmail(user.id, user.email, user.name).catch(() => undefined);
  }

  return json(
    { item: { user: { id: user.id, email: user.email, name: user.name }, organization: { id: org.id, name: org.name, planId: org.planId }, role: "owner" } },
    { status: 201 },
  );
});
