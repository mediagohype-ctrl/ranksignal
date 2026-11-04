// Staff alerts (owner/ops): email to STAFF_ALERT_EMAIL (comma-separated allowed) and WhatsApp to STAFF_WHATSAPP
// when set. Deduped through SentMessage(kind, key): the same kind+key is sent at most once, ever — so pick keys
// like "<day>" or "<orgId>:<eventId>". Never throws; returns what happened.
//
// Kinds are stored as "staff_<kind>" so they never collide with customer message kinds (e.g. trial_day1).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { isWhatsAppConfigured, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp/send";

export interface StaffAlert {
  /** e.g. "ai_budget_80", "job_failed", "payment_failed", "trial_ending". */
  kind: string;
  /** Dedupe key within the kind. */
  key: string;
  subject: string;
  text: string;
  organizationId?: string | null;
}

export type StaffAlertResult = { status: "sent"; email: boolean; whatsapp: boolean } | { status: "duplicate" } | { status: "skipped"; reason: string } | { status: "failed" };

export const staffAlertKind = (kind: string) => (kind.startsWith("staff_") ? kind : `staff_${kind}`);

function staffEmails(): string[] {
  return (process.env.STAFF_ALERT_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

export async function sendStaffAlert(a: StaffAlert): Promise<StaffAlertResult> {
  const emails = isEmailConfigured() ? staffEmails() : [];
  const whatsappTo = isWhatsAppConfigured() ? process.env.STAFF_WHATSAPP?.trim() : undefined;
  if (emails.length === 0 && !whatsappTo) {
    console.warn(`[alerts] staff alert not sent (set STAFF_ALERT_EMAIL + email, or STAFF_WHATSAPP + WhatsApp): ${a.kind}`);
    return { status: "skipped", reason: "no_channel" };
  }
  const kind = staffAlertKind(a.kind);
  const key = a.key.slice(0, 300);
  let rowId: string;
  try {
    // Insert first: unique(kind, key) makes concurrent/repeated alerts fail with P2002.
    const row = await db.sentMessage.create({ data: { organizationId: a.organizationId ?? null, channel: "staff", kind, key }, select: { id: true } });
    rowId = row.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "duplicate" };
    console.warn("[alerts] could not record staff alert", (err as Error)?.name);
    return { status: "failed" };
  }

  let email = false;
  let whatsapp = false;
  try {
    if (emails.length) {
      const { html, text } = renderEmail({ title: a.subject, preheader: a.text.slice(0, 120), paragraphs: a.text.split(/\n{2,}/), footer: `Staff alert · ${kind}` });
      for (const to of emails) email = (await sendEmail({ to, subject: `[Staff] ${a.subject}`, html, text })).ok || email;
    }
    if (whatsappTo) {
      const template = process.env.STAFF_WHATSAPP_TEMPLATE?.trim();
      const body = `${a.subject}\n\n${a.text}`;
      whatsapp = (template ? await sendWhatsAppTemplate(whatsappTo, { name: template, params: [body.slice(0, 1000)] }) : await sendWhatsApp(whatsappTo, body)).ok;
    }
  } catch (err) {
    console.warn("[alerts] staff alert send failed", (err as Error)?.name);
  }
  if (!email && !whatsapp) {
    // Nothing went out: forget the dedupe row so a later attempt can retry.
    await db.sentMessage.delete({ where: { id: rowId } }).catch(() => undefined);
    return { status: "failed" };
  }
  return { status: "sent", email, whatsapp };
}
