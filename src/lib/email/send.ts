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
      ...(o.replyTo ? { replyTo: o.replyTo } : {}),
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
        ...(o.replyTo ? { reply_to: o.replyTo } : {}),
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
