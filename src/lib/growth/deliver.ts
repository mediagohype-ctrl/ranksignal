// Recipients + delivery for growth messages. Emails go to owners (and admins where noted) with a confirmed
// email address; WhatsApp only when the organization opted in and saved a number.
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import type { EmailContent } from "@/lib/email/templates";
import { isWhatsAppConfigured, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp/send";
import { claimOnce, releaseClaim } from "./once";

export async function verifiedRecipients(organizationId: string, roles: string[] = ["owner"]): Promise<string[]> {
  const members = await db.membership.findMany({
    where: { organizationId, status: "active", role: { in: roles }, user: { emailVerified: true } },
    select: { user: { select: { email: true } } },
  });
  return [...new Set(members.map((m) => m.user.email).filter(Boolean))];
}

export interface WhatsAppTarget {
  whatsappOptIn: boolean;
  whatsappNumber: string | null;
}

export function canWhatsApp(org: WhatsAppTarget | null | undefined): org is WhatsAppTarget & { whatsappNumber: string } {
  return !!org && org.whatsappOptIn && !!org.whatsappNumber;
}

/**
 * Email `content` to `to` once per (kind, key). Returns true when at least one email went out.
 * Not configured → nothing claimed (so it sends once email is set up). Every send failed → claim released.
 */
export async function emailOnce(o: { kind: string; key: string; organizationId: string; to: string[]; content: EmailContent }): Promise<boolean> {
  if (!isEmailConfigured() || o.to.length === 0) return false;
  if (!(await claimOnce({ kind: o.kind, key: o.key, organizationId: o.organizationId, channel: "email" }))) return false;
  let sent = 0;
  for (const to of o.to) {
    try {
      const r = await sendEmail({ to, subject: o.content.subject, html: o.content.html, text: o.content.text });
      if (r.ok) sent++;
    } catch (e) {
      console.error(`[growth] ${o.kind} email failed:`, e instanceof Error ? e.message : e);
    }
  }
  if (sent === 0) await releaseClaim(o.kind, o.key);
  return sent > 0;
}

/** WhatsApp `text` once per (kind, key) to an opted-in organization. */
export async function whatsappOnce(o: { kind: string; key: string; organizationId: string; org: WhatsAppTarget | null; text: string }): Promise<boolean> {
  if (!canWhatsApp(o.org) || !isWhatsAppConfigured()) return false;
  if (!(await claimOnce({ kind: o.kind, key: o.key, organizationId: o.organizationId, channel: "whatsapp" }))) return false;
  try {
    // Meta only delivers free-form text within 24h of the customer's last message, so business-started updates
    // should go through an approved template whose body is a single {{1}} (WHATSAPP_UPDATE_TEMPLATE).
    const template = process.env.WHATSAPP_UPDATE_TEMPLATE?.trim();
    const r = template
      ? await sendWhatsAppTemplate(o.org.whatsappNumber, { name: template, language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en", params: [o.text] })
      : await sendWhatsApp(o.org.whatsappNumber, o.text);
    if (!r.ok) await releaseClaim(o.kind, o.key); // nothing delivered: free the key for a retry
    return r.ok;
  } catch (e) {
    console.error(`[growth] ${o.kind} whatsapp failed:`, e instanceof Error ? e.message : e);
    await releaseClaim(o.kind, o.key);
    return false;
  }
}
