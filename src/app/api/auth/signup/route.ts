import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH, UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
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
});

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
  // A placeholder user (created by an org invite) may claim the account; real accounts may not be re-registered.
  if (existing && existing.passwordHash !== UNUSABLE_PASSWORD) {
    throw new HttpError(409, "email_taken", "An account with this email already exists. Try signing in.");
  }

  const { user, org } = await db.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash, name: input.name } })
      : await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
    const org = await tx.organization.create({ data: { name: input.organizationName, planId: "trial", status: "active" } });
    await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner", status: "active" } });
    await tx.subscription.create({
      data: { organizationId: org.id, provider: "razorpay", planId: "trial", status: "trialing", trialEndsAt, currentPeriodStart: new Date(), currentPeriodEnd: trialEndsAt },
    });
    return { user, org };
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
