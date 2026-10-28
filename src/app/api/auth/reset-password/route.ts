import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset";
import { passwordPolicyError } from "@/lib/security/email-policy";
import { passwordChangedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({
  token: z.string().min(10).max(4096),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
});

const INVALID = "This reset link is invalid, has expired or has already been used. Request a new one.";

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  if (!checkRateLimit(`reset-ip:${ip}`, 20, 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many attempts. Please try again later.");
  }
  const input = await parseBody(req, schema);

  const verified = await verifyPasswordResetToken(input.token, async (userId) => {
    const u = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    return u?.passwordHash ?? null;
  });
  if (!verified) throw new HttpError(400, "invalid_token", INVALID);

  const user = await db.user.findUniqueOrThrow({ where: { id: verified.userId }, select: { id: true, email: true, name: true } });
  const policy = passwordPolicyError(input.password, user.email);
  if (policy) throw new HttpError(400, "validation_error", policy, { fieldErrors: { password: [policy] } });

  const passwordHash = await hashPassword(input.password);
  // Compare-and-swap on the old hash: a second concurrent use of the same link updates nothing.
  const updated = await db.user.updateMany({
    where: { id: user.id, passwordHash: verified.passwordHash },
    data: { passwordHash, emailVerified: true },
  });
  if (updated.count !== 1) throw new HttpError(400, "invalid_token", INVALID);

  await writeAuditLog({ actorId: user.id, action: "auth.password_reset", resourceType: "user", resourceId: user.id, ip });
  await sendEmail({ to: user.email, ...passwordChangedTemplate({ name: user.name }) }).catch(() => undefined);
  return json({ ok: true });
});
