import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { passwordPolicyError } from "@/lib/security/email-policy";
import { passwordChangedTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { writeAuditLog } from "@/lib/audit-log";
import { setSessionCookie } from "@/lib/auth/session";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
});

function fieldError(field: string, message: string, status = 400, code = "validation_error") {
  return new HttpError(status, code, message, { fieldErrors: { [field]: [message] } });
}

/** POST {currentPassword, newPassword} — change password (requires the current one). */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const ip = clientIp(req);
  if (!checkRateLimit(`pw-change:${s.userId}`, 5, 15 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  }
  const input = await parseBody(req, schema);
  const user = await db.user.findUniqueOrThrow({ where: { id: s.userId }, select: { id: true, email: true, name: true, passwordHash: true } });

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw fieldError("currentPassword", "Your current password isn't right.", 400, "invalid_password");
  }
  if (input.newPassword === input.currentPassword) throw fieldError("newPassword", "Choose a password you haven't used here before.");
  const policy = passwordPolicyError(input.newPassword, user.email);
  if (policy) throw fieldError("newPassword", policy);

  const passwordHash = await hashPassword(input.newPassword);
  const res = await db.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash }, data: { passwordHash } });
  if (res.count !== 1) throw new HttpError(409, "conflict", "Your password was changed somewhere else. Reload and try again.");

  // Sessions are bound to the password; re-issue this device's session so only OTHER devices are signed out.
  await setSessionCookie(s);
  await writeAuditLog({ organizationId: s.organizationId, actorId: s.userId, action: "account.password_changed", resourceType: "user", resourceId: s.userId, ip });
  await sendEmail({ to: user.email, ...passwordChangedTemplate({ name: user.name }) }).catch(() => undefined);
  return json({ ok: true });
});
