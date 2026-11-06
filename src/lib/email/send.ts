// Transactional email. Uses SMTP (e.g. Hostinger) when SMTP_HOST/SMTP_USER/SMTP_PASS are set,
// otherwise the Resend REST API when RESEND_API_KEY is set. EMAIL_FROM is required either way;
// without a configured transport it no-ops. Never logs bodies, links or tokens — only a one-line status.
import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /**
   * Holds a one-time secret link (password reset, email check, team invite). These are never copied to
   * EMAIL_BCC: anyone reading the copy could use the link to get into the customer's account.
   */
  private?: boolean;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
}

const RESEND_URL = "https://api.resend.com/emails";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_FROM && (smtpConfigured() || process.env.RESEND_API_KEY));
}

/** EMAIL_BCC: comma-separated addresses that get a hidden copy of every non-private email. */
export function bccFor(o: Pick<SendEmailInput, "to" | "private">, list = process.env.EMAIL_BCC ?? ""): string[] {
  if (o.private) return [];
  const to = o.to.trim().toLowerCase();
  const seen = new Set<string>();
  for (const a of list.split(",")) {
    const e = a.trim().toLowerCase();
    if (e && e !== to && /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(e)) seen.add(e);
  }
  return [...seen];
}

/** EMAIL_REPLY_TO: where customer replies go when the email doesn't set its own reply-to. */
function replyToFor(o: SendEmailInput): string | undefined {
  return o.replyTo || process.env.EMAIL_REPLY_TO || undefined;
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 = implicit TLS; 587 = STARTTLS (secure false, upgraded by the server).
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

async function sendViaSmtp(from: string, o: SendEmailInput): Promise<SendEmailResult> {
  try {
    const info = await getTransporter().sendMail({
      from,
      to: o.to,
      subject: o.subject,
      html: o.html,
      text: o.text,
      ...(bccFor(o).length ? { bcc: bccFor(o) } : {}),
      ...(replyToFor(o) ? { replyTo: replyToFor(o) } : {}),
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    // SMTP errors can echo addresses but never credentials; log only the class/code.
    const code = (err as { code?: string; responseCode?: number }).responseCode ?? (err as { code?: string }).code;
    console.warn(`[email] smtp send failed${code ? `: ${code}` : ""}`);
    return { ok: false };
  }
}

async function sendViaResend(apiKey: string, from: string, o: SendEmailInput): Promise<SendEmailResult> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [o.to],
        subject: o.subject,
        html: o.html,
        text: o.text,
        ...(bccFor(o).length ? { bcc: bccFor(o) } : {}),
        ...(replyToFor(o) ? { reply_to: replyToFor(o) } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[email] send failed: HTTP ${res.status}`);
      return { ok: false };
    }
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: data?.id };
  } catch (err) {
    console.warn(`[email] send failed: ${err instanceof Error ? err.name : "error"}`);
    return { ok: false };
  }
}

export async function sendEmail(o: SendEmailInput): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM;
  if (from && smtpConfigured()) return sendViaSmtp(from, o);
  const apiKey = process.env.RESEND_API_KEY;
  if (from && apiKey) return sendViaResend(apiKey, from, o);
  console.info("[email] not configured (EMAIL_FROM plus SMTP_* or RESEND_API_KEY missing); skipped sending");
  return { ok: false, skipped: true };
}
