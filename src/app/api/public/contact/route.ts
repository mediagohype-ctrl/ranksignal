// POST /api/public/contact — unauthenticated contact form → support inbox (replyTo = sender).
// Captcha + per-IP/global rate limits. A best-effort Lead row (admin CRM) is stored; it never blocks the response.
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email/send";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { contactEmail, contactSchema } from "@/lib/free-check/contact";
import { checkContactLimit } from "@/lib/free-check/limits";
import { recordLeadInBackground } from "@/lib/admin/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, contactSchema);
  const ip = clientIp(req);

  // Bots that fill the hidden field get a normal-looking success and nothing is sent.
  if (body.website) return json({ ok: true });

  const limit = checkContactLimit(ip);
  if (!limit.allowed) {
    throw new HttpError(429, "rate_limited", "Too many messages from this connection. Please try again later or email us directly.", {
      retryAfterSec: limit.retryAfterSec,
    });
  }
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "The security check failed. Please try again.");
  }

  recordLeadInBackground({ source: "contact", name: body.name, email: body.email, company: body.company, message: body.message, ip });

  const { subject, html, text } = contactEmail(body, { ip, at: new Date() });
  const res = await sendEmail({ to: BRAND.supportEmail, subject, html, text, replyTo: body.email });
  if (!res.ok) {
    console.warn(`[contact] message not delivered (${res.skipped ? "email not configured" : "send failed"})`);
    throw new HttpError(503, "email_unavailable", `We couldn't send your message right now. Please email ${BRAND.supportEmail} instead.`);
  }
  return json({ ok: true });
});
