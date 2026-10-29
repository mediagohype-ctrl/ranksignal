// Transactional email layout: table-based, inline styles, white background. Every input is escaped.
import { BRAND } from "@/lib/brand";

export interface RenderEmailInput {
  title: string;
  preheader?: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer?: string;
  /** Optional white-label branding (see src/lib/branding.ts). Omitted = the default product branding, unchanged. */
  branding?: EmailBranding;
}

export interface EmailBranding {
  displayName?: string;
  /** https:// only; anything else is ignored. */
  logoUrl?: string;
  /** #rrggbb; anything else is ignored. */
  accentColor?: string;
  /** Extra footer line (≤ 200 chars). */
  footerText?: string;
  /** Drop the "Sent with <product>" line. */
  hidePoweredBy?: boolean;
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

/** Logo images: https only (no http:, data:, javascript:). */
function httpsOnly(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}
const hexOnly = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : null);

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
  const b = o.branding;
  const brandName = b?.displayName?.trim() ? b.displayName.trim().slice(0, 80) : BRAND.name;
  const accent = hexOnly(b?.accentColor) ?? C.primary;
  const logo = b ? httpsOnly(b.logoUrl) : `${BRAND.appUrl.replace(/\/$/, "")}/brand/logo-mark-96.png`;
  const extraFooter = b?.footerText?.trim() ? b.footerText.trim().slice(0, 200) : null;
  const title = escapeHtml(o.title);
  const brand = escapeHtml(brandName);
  const paragraphs = o.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${C.soft};">${escapeHtml(p)}</p>`)
    .join("");
  const ctaUrl = o.cta ? safeUrl(o.cta.url) : null;
  const cta =
    o.cta && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:10px;background:${accent};">` +
        `<a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.primaryFg};text-decoration:none;border-radius:10px;">${escapeHtml(o.cta.label)}</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 16px 0;font-size:13px;line-height:20px;color:${C.muted};">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(ctaUrl)}" style="color:${accent};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
      : "";
  const footerRaw = o.footer ?? `You're receiving this email because of your ${brandName} account.`;
  const footer = escapeHtml(footerRaw);
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(o.preheader)}</div>`
    : "";
  const logoImg = logo
    ? b
      ? `<img src="${escapeHtml(logo)}" height="32" alt="${brand}" style="vertical-align:middle;border:0;max-height:32px;max-width:200px;margin-right:8px;">`
      : `<img src="${escapeHtml(logo)}" width="28" height="28" alt="" style="vertical-align:middle;border:0;margin-right:8px;">`
    : "";
  // Branded: the org's name (+ optional "Sent with" line). Default: product name + support address.
  const signature = b
    ? `${brand}${b.hidePoweredBy ? "" : ` &middot; Sent with ${escapeHtml(BRAND.name)}`}`
    : `${brand} &middot; <a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:${C.muted};">${escapeHtml(BRAND.supportEmail)}</a>`;
  const signatureText = b ? `${brandName}${b.hidePoweredBy ? "" : ` · Sent with ${BRAND.name}`}` : `${BRAND.name} · ${BRAND.supportEmail}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};font-family:${FONT};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px 4px;font-size:19px;font-weight:700;letter-spacing:-0.3px;color:${C.fg};${b ? `border-top:4px solid ${accent};padding-top:12px;` : ""}">${logoImg}${brand}</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px 28px;">
<h1 style="margin:0 0 16px 0;font-size:22px;line-height:30px;font-weight:650;color:${C.fg};">${title}</h1>
${paragraphs}${cta}
</td></tr>
<tr><td style="padding:16px 4px 0 4px;font-size:12px;line-height:18px;color:${C.muted};">${footer}${extraFooter ? `<br>${escapeHtml(extraFooter)}` : ""}<br>${signature}</td></tr>
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
    footerRaw,
    ...(extraFooter ? [extraFooter] : []),
    signatureText,
  ].join("\n");

  return { html, text };
}
