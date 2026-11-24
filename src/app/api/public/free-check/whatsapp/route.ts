// POST /api/public/free-check/whatsapp — "Send it to my WhatsApp": stores the visitor's WhatsApp number on the
// free-check lead (or, when the check failed, on a new lead for that website), sends the report link on WhatsApp and
// alerts sales. Meta "Lead" fires exactly once per number saved, server side, with the event id the page also uses
// for its pixel event (Meta drops the duplicate). Rate-limited, zod-validated, honeypot; no captcha (the check had one).
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { recordLead } from "@/lib/admin/leads";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { checkFreeCheckEmailLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl } from "@/lib/free-check/validate";
import {
  decideLeadWhatsApp,
  leadWhatsAppSchema,
  normalizeIndianMobile,
  reportLink,
  salesAlert,
  visitorMessage,
} from "@/lib/free-check/lead-whatsapp";
import { resultHost } from "@/lib/free-check/share";
import { metaVisitor, trackMeta } from "@/lib/meta/capi";
import { sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = await parseBody(req, leadWhatsAppSchema);
  if (body.website) return json({ ok: true }); // bot filled the honeypot: look normal, store nothing

  const phone = normalizeIndianMobile(body.phone);
  if (!phone) throw new HttpError(400, "invalid_phone", "Enter your 10-digit WhatsApp number, like 98765 43210.");

  const ip = clientIp(req);
  const limit = checkFreeCheckEmailLimit(ip);
  if (!limit.allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries from this connection. Please try again in an hour.", { retryAfterSec: limit.retryAfterSec });
  }

  let leadId: string;
  let lead: { id: string; url: string | null; score: number | null; message: string | null; attribution: unknown };
  let changed = true;
  if (body.leadId) {
    const row = await db.lead.findUnique({
      where: { id: body.leadId },
      select: { id: true, source: true, phone: true, createdAt: true, url: true, score: true, message: true, attribution: true },
    });
    const decision = decideLeadWhatsApp(row, phone);
    if (!decision.ok || !row) {
      throw new HttpError(404, "check_not_found", "We couldn't find this check any more. Run the free check again, then add your number.");
    }
    changed = decision.changed;
    if (changed) {
      await db.lead.update({
        where: { id: row.id },
        data: { phone, ...(row.attribution == null && body.attribution && Object.keys(body.attribution).length ? { attribution: body.attribution } : {}) },
      });
    }
    leadId = row.id;
    lead = row;
  } else {
    // The check failed (or its lead row couldn't be stored): a new lead for that website, so the team can follow up.
    const url = normalizeInputUrl(body.url);
    if (!url) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");
    const message = body.failure ? `Free check failed (${body.failure}) — send the report by hand.` : "Free check finished; number left on the result.";
    const id = await recordLead({ source: "free_check", url, message, ip, phone, attribution: body.attribution });
    if (!id) throw new HttpError(503, "unavailable", "We couldn't save your number just now. Please try again in a minute.");
    leadId = id;
    lead = { id, url, score: null, message, attribution: body.attribution ?? null };
  }

  const eventId = `wa-lead-${leadId}`;
  if (changed) {
    const websiteUrl = lead.url ?? "";
    const failed = Boolean(body.failure);
    const link = reportLink(BRAND.appUrl, websiteUrl);

    // 1. The visitor's WhatsApp. Outside a 24-hour chat window Meta only delivers approved templates, so production
    //    needs WHATSAPP_REPORT_TEMPLATE (body params: {{1}} website, {{2}} score, {{3}} link).
    const template = process.env.WHATSAPP_REPORT_TEMPLATE?.trim();
    const send = template
      ? sendWhatsAppTemplate(phone, {
          name: template,
          language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en",
          params: [resultHost(websiteUrl), lead.score === null ? "—" : String(Math.round(lead.score)), failed ? `${BRAND.appUrl.replace(/\/+$/, "")}/contact` : link],
        })
      : sendWhatsApp(phone, visitorMessage({ websiteUrl, score: lead.score, link, failed }));
    void send.catch(() => undefined);

    // 2. Sales, at the same moment.
    const alert = salesAlert({
      phone,
      websiteUrl,
      score: lead.score,
      topFix: lead.message && !failed ? lead.message : null,
      failure: failed ? (body.failure ?? "failed") : null,
      attribution: (lead.attribution as Record<string, string | undefined> | null) ?? body.attribution,
      leadId,
      appUrl: BRAND.appUrl,
    });
    void sendStaffAlert({ kind: "free_check_whatsapp", key: leadId, subject: alert.subject, text: alert.text }).catch(() => undefined);

    // 3. Meta Lead, once per number saved (the page sends the pixel event with the same id).
    const v = metaVisitor(req);
    trackMeta({ name: "Lead", eventId, sourceUrl: v.sourceUrl, user: { ...v.user, phone }, custom: { content_name: failed ? "free_check_failed" : "free_check" } });
  }

  return json({ ok: true, eventId, firstTime: changed }, { headers: { "Cache-Control": "no-store" } });
});
