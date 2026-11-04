// POST /api/public/free-check/email — "Email me my full result": stores the visitor's email on the Lead row
// created by POST /api/public/free-check. Rate-limited (5/IP/hour, 120/hour overall), zod-validated, no captcha
// (the check itself had one). Unknown/expired ids get the same plain error, so ids cannot be probed.
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { checkFreeCheckEmailLimit } from "@/lib/free-check/limits";
import { decideLeadEmail, leadEmailSchema } from "@/lib/free-check/lead-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, leadEmailSchema);
  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (body.website) return json({ ok: true });

  const limit = checkFreeCheckEmailLimit(clientIp(req));
  if (!limit.allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries from this connection. Please try again later.", { retryAfterSec: limit.retryAfterSec });
  }

  const lead = await db.lead.findUnique({ where: { id: body.leadId }, select: { id: true, source: true, email: true, createdAt: true } });
  const decision = decideLeadEmail(lead, body.email);
  if (!decision.ok) {
    throw new HttpError(404, "check_not_found", "We couldn't find this check any more. Run the free check again, then add your email.");
  }
  if (decision.changed) await db.lead.update({ where: { id: body.leadId }, data: { email: body.email } });
  return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
