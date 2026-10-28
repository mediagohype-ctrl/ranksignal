// Transactional email layout: table-based, inline styles, white background. Every input is escaped.
import { BRAND } from "@/lib/brand";

export interface RenderEmailInput {
  title: string;
  preheader?: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer?: string;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** Only http(s) links are allowed in CTAs; anything else (javascript:, data:) becomes "#". */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}

// Email clients ignore CSS variables, so the palette is inlined here (mirrors the light theme tokens).
const C = {
  bg: "#f5f6fa",
  card: "#ffffff",
  border: "#e4e6ef",
  fg: "#151a2d",
  soft: "#3b4258",
  muted: "#5b6275",
  primary: "#4f46e5",
  primaryFg: "#ffffff",
};
const FONT = "'Google Sans Flex','Google Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmail(o: RenderEmailInput): { html: string; text: string } {
  const title = escapeHtml(o.title);
  const brand = escapeHtml(BRAND.name);
  const paragraphs = o.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${C.soft};">${escapeHtml(p)}</p>`)
    .join("");
  const ctaUrl = o.cta ? safeUrl(o.cta.url) : null;
  const cta =
    o.cta && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:10px;background:${C.primary};">` +
        `<a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.primaryFg};text-decoration:none;border-radius:10px;">${escapeHtml(o.cta.label)}</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 16px 0;font-size:13px;line-height:20px;color:${C.muted};">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(ctaUrl)}" style="color:${C.primary};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
      : "";
  const footer = escapeHtml(o.footer ?? `You're receiving this email because of your ${BRAND.name} account.`);
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(o.preheader)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};font-family:${FONT};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px 4px;font-size:18px;font-weight:700;color:${C.fg};">${brand}</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px 28px;">
<h1 style="margin:0 0 16px 0;font-size:22px;line-height:30px;font-weight:650;color:${C.fg};">${title}</h1>
${paragraphs}${cta}
</td></tr>
<tr><td style="padding:16px 4px 0 4px;font-size:12px;line-height:18px;color:${C.muted};">${footer}<br>${brand} &middot; <a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:${C.muted};">${escapeHtml(BRAND.supportEmail)}</a></td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    o.title,
    "",
    ...o.paragraphs.flatMap((p) => [p, ""]),
    ...(o.cta && ctaUrl ? [`${o.cta.label}: ${ctaUrl}`, ""] : []),
    "--",
    o.footer ?? `You're receiving this email because of your ${BRAND.name} account.`,
    `${BRAND.name} · ${BRAND.supportEmail}`,
  ].join("\n");

  return { html, text };
}
