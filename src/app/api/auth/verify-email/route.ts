import { NextResponse } from "next/server";
import { handler, json, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { readEmailVerificationToken, sendVerificationEmail } from "@/lib/auth/email-verification";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { isEmailConfigured } from "@/lib/email/send";
import { writeAuditLog } from "@/lib/audit-log";

/** GET ?token=… — consumes a verification link, then redirects into the app. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const parsed = await readEmailVerificationToken(token);
  if (parsed) {
    const res = await db.user.updateMany({ where: { id: parsed.userId, email: parsed.email, emailVerified: false }, data: { emailVerified: true } });
    if (res.count > 0) {
      await writeAuditLog({ actorId: parsed.userId, action: "auth.email_verified", resourceType: "user", resourceId: parsed.userId }).catch(() => undefined);
    }
  }
  // Behind Render's proxy req.url can carry an internal origin, so prefer the configured public URL.
  return NextResponse.redirect(new URL(parsed ? "/app?verified=1" : "/login?verify_error=1", process.env.APP_URL || url.origin));
});

/** POST — resend the verification link for the signed-in user. */
export const POST = handler(async () => {
  const s = await requireSession("viewer");
  if (!checkRateLimit(`verify-resend:${s.userId}`, 3, 15 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "We've just sent a link. Please check your inbox (and spam) or try again in a few minutes.");
  }
  const user = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, name: true, emailVerified: true } });
  if (!user || user.emailVerified) return json({ ok: true, alreadyVerified: true });
  if (!isEmailConfigured()) {
    throw new HttpError(503, "email_unavailable", "Email sending isn't set up yet. Please contact support to verify your address.");
  }
  const sent = await sendVerificationEmail(user.id, user.email, user.name);
  if (!sent.ok) throw new HttpError(502, "email_failed", "We couldn't send the email just now. Please try again shortly.");
  return json({ ok: true });
});
