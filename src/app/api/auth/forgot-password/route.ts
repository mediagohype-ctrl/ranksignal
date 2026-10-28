import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

const GENERIC = { ok: true, message: "If an account exists for that email, we've sent a link to reset the password." };

/** Always answers with the same generic 200 so it can't be used to discover which emails have accounts. */
export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  if (!checkRateLimit(`forgot-ip:${ip}`, 20, 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many requests. Please try again later.");
  }
  const { email } = await parseBody(req, schema);
  // Per IP+email: silently stop sending (still the generic response) so the inbox can't be flooded.
  if (!checkRateLimit(`forgot:${ip}:${email}`, 3, 60 * 60 * 1000).allowed) return json(GENERIC);
  if (!checkRateLimit(`forgot-email:${email}`, 5, 60 * 60 * 1000).allowed) return json(GENERIC);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, passwordHash: true } });
  // Placeholder (invited, never signed-up) users have no password to reset; they should sign up instead.
  if (user && user.passwordHash !== UNUSABLE_PASSWORD) {
    // Not awaited: response time must not depend on whether the account exists.
    void (async () => {
      await sendPasswordResetEmail(user);
      await writeAuditLog({ actorId: user.id, action: "auth.password_reset_requested", resourceType: "user", resourceId: user.id, ip });
    })().catch((e) => console.warn("[auth] password reset email failed", e instanceof Error ? e.name : "error"));
  }
  return json(GENERIC);
});
