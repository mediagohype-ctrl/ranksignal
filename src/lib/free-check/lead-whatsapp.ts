// "Send it to my WhatsApp" after a free check (or after a check that failed): validation, the visitor's message and
// the sales alert (pure, unit-tested).
import { z } from "zod";
import { attributionSchema } from "@/lib/attribution";
import { freeCheckLink, resultHost } from "@/lib/free-check/share";

/**
 * Indian mobile numbers: 10 digits starting 6–9, typed with or without +91 / 0 / spaces / dashes.
 * Returns "91XXXXXXXXXX" (as the WhatsApp Cloud API expects), or null.
 */
export function normalizeIndianMobile(raw: string): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `91${d}` : null;
}

export const leadWhatsAppSchema = z
  .object({
    /** Lead row of the finished check. Absent when the check failed (then `url` says which site). */
    leadId: z.string().trim().min(10).max(64).regex(/^[a-z0-9]+$/i).optional(),
    url: z.string().trim().max(2048).optional(),
    /** Why the check failed, for the team ("unreachable", "timeout", …). */
    failure: z.string().max(40).optional(),
    phone: z.string().trim().max(32),
    attribution: attributionSchema,
    /** Honeypot: hidden from people, often filled by bots. */
    website: z.string().max(500).optional(),
  })
  .refine((v) => v.leadId || v.url, { message: "leadId or url is required" });
export type LeadWhatsAppInput = z.infer<typeof leadWhatsAppSchema>;

export const LEAD_WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type LeadWhatsAppDecision = { ok: true; changed: boolean } | { ok: false; reason: "not_found" | "expired" | "taken" };

/** Same rules as the email box: free-check leads only, within 24 hours, never overwrite a different number. */
export function decideLeadWhatsApp(
  lead: { source: string; phone: string | null; createdAt: Date } | null,
  phone: string,
  now = Date.now(),
): LeadWhatsAppDecision {
  if (!lead || lead.source !== "free_check") return { ok: false, reason: "not_found" };
  if (now - lead.createdAt.getTime() > LEAD_WHATSAPP_WINDOW_MS) return { ok: false, reason: "expired" };
  if (lead.phone && lead.phone !== phone) return { ok: false, reason: "taken" };
  return { ok: true, changed: lead.phone !== phone };
}

/** The link in the visitor's WhatsApp message: the free check for their site (instant for 24 hours: cached). */
export function reportLink(appUrl: string, websiteUrl: string): string {
  return `${freeCheckLink(appUrl, websiteUrl)}&utm_source=whatsapp&utm_medium=lead&utm_campaign=free_check_report`;
}

/** Plain-text message to the visitor (used when no approved template is set; needs an open 24-hour window). */
export function visitorMessage(o: { websiteUrl: string; score: number | null; link: string; failed: boolean }): string {
  const host = resultHost(o.websiteUrl);
  if (o.failed) {
    return `Hi! This is MyWebRank. We couldn't read ${host} automatically, so our team will check it by hand and send your report here today. Reply to this message with any questions.`;
  }
  const score = o.score === null ? "" : ` (score ${Math.round(o.score)}/100)`;
  return `Hi! Your free website report for ${host}${score} is ready: ${o.link}\n\nIt shows every fix, step by step. Want our team to do it for you? Just reply here.`;
}

/** Sales alert text. */
export function salesAlert(o: {
  phone: string;
  websiteUrl: string;
  score: number | null;
  topFix: string | null;
  failure: string | null;
  attribution: Record<string, string | undefined> | null | undefined;
  leadId: string;
  appUrl: string;
}): { subject: string; text: string } {
  const host = resultHost(o.websiteUrl);
  const src = o.attribution
    ? [o.attribution.utm_source, o.attribution.utm_medium, o.attribution.utm_campaign].filter(Boolean).join(" / ") || (o.attribution.fbclid ? "Meta ad (fbclid)" : "")
    : "";
  const lines = [
    `WhatsApp: +${o.phone}  (https://wa.me/${o.phone})`,
    `Website: ${host}`,
    o.failure ? `Check FAILED (${o.failure}) — run it by hand and send the report.` : `Score: ${o.score === null ? "—" : Math.round(o.score)}/100`,
    o.topFix ? `Top fix: ${o.topFix}` : "",
    src ? `Source: ${src}` : "",
    `Lead: ${o.appUrl.replace(/\/+$/, "")}/admin/leads/${o.leadId}`,
  ].filter(Boolean);
  return { subject: `${o.failure ? "Failed check" : "New"} WhatsApp lead: ${host}`, text: lines.join("\n") };
}
