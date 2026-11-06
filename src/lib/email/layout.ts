// Transactional email layout: table-based with inline styles (works in Gmail, Outlook, Apple Mail), branded
// header, white card with an accent stripe, sign-off, help line and company footer. Every input is escaped.
import { BRAND } from "@/lib/brand";

export interface RenderEmailInput {
  title: string;
  preheader?: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer?: string;
  /** Optional white-label branding (see src/lib/branding.ts). Omitted = the default product branding. */
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
  bg: "#f3f4f8",
  card: "#ffffff",
  border: "#e4e6ef",
  fg: "#151a2d",
  soft: "#3b4258",
  muted: "#6b7285",
  primary: "#4338ca",
  primaryFg: "#ffffff",
  panel: "#f7f8fc",
};
const FONT = "'Google Sans Flex','Google Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const siteUrl = () => BRAND.appUrl.replace(/\/$/, "");

export function renderEmail(o: RenderEmailInput): { html: string; text: string } {
  const b = o.branding;
  const brandName = b?.displayName?.trim() ? b.displayName.trim().slice(0, 80) : BRAND.name;
  const accent = hexOnly(b?.accentColor) ?? C.primary;
  const logo = b ? httpsOnly(b.logoUrl) : `${siteUrl()}/brand/logo-mark-96.png`;
  const extraFooter = b?.footerText?.trim() ? b.footerText.trim().slice(0, 200) : null;
  const title = escapeHtml(o.title);
  const brand = escapeHtml(brandName);
  const site = escapeHtml(siteUrl());

  const paragraphs = o.paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;font-size:15px;line-height:25px;color:${C.soft};">${escapeHtml(p)}</p>`)
    .join("");
  const ctaUrl = o.cta ? safeUrl(o.cta.url) : null;
  const cta =
    o.cta && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 24px 0;"><tr><td bgcolor="${accent}" style="border-radius:10px;background:${accent};">` +
        `<a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${C.primaryFg};text-decoration:none;border-radius:10px;">${escapeHtml(o.cta.label)} &rarr;</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 8px 0;font-size:12px;line-height:19px;color:${C.muted};">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(ctaUrl)}" style="color:${accent};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
      : "";

  const footerRaw = o.footer ?? `You're receiving this email because you have a ${brandName} account.`;
  const footer = escapeHtml(footerRaw);
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(o.preheader)}</div>`
    : "";

  // Header: product logo + two-tone MYWEBRANK wordmark, or the agency's own logo/name when white-labelled.
  const w1 = escapeHtml(BRAND.wordmark[0].toUpperCase());
  const w2 = escapeHtml(BRAND.wordmark[1].toUpperCase());
  const headerLeft = b
    ? `${logo ? `<img src="${escapeHtml(logo)}" height="36" alt="${brand}" style="vertical-align:middle;border:0;max-height:36px;max-width:200px;margin-right:10px;">` : ""}` +
      `<span style="font-size:18px;font-weight:700;color:${C.fg};vertical-align:middle;">${brand}</span>`
    : `<a href="${site}" target="_blank" rel="noopener" style="text-decoration:none;">` +
      `<img src="${escapeHtml(logo!)}" width="36" height="36" alt="${escapeHtml(BRAND.name)}" style="vertical-align:middle;border:0;margin-right:10px;">` +
      `<span style="font-size:19px;font-weight:800;letter-spacing:0.4px;color:${C.fg};vertical-align:middle;">${w1}<span style="color:${C.primary};">${w2}</span></span></a>`;
  const headerRight = b
    ? ""
    : `<a href="${site}" target="_blank" rel="noopener" style="font-size:12px;color:${C.muted};text-decoration:none;">${escapeHtml(BRAND.domain)}</a>`;

  const signOff =
    `<p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid ${C.border};font-size:14px;line-height:22px;color:${C.soft};">` +
    `Warm regards,<br><strong style="color:${C.fg};">The ${brand} team</strong></p>`;

  // Default emails: help box + company footer. White-label: the agency's footer (+ optional "Sent with").
  const help = b
    ? ""
    : `<tr><td style="padding:16px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="background:${C.panel};border:1px solid ${C.border};border-radius:12px;padding:14px 18px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.soft};">` +
      `<strong style="color:${C.fg};">Need help?</strong> Just reply to this email or write to ` +
      `<a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:${C.primary};text-decoration:none;font-weight:600;">${escapeHtml(BRAND.supportEmail)}</a>` +
      ` &mdash; a real person will get back to you.</td></tr></table></td></tr>`;
  const link = (path: string, label: string) =>
    `<a href="${site}${path}" target="_blank" rel="noopener" style="color:${C.muted};text-decoration:underline;">${label}</a>`;
  const signature = b
    ? `${brand}${b.hidePoweredBy ? "" : ` &middot; Sent with ${escapeHtml(BRAND.name)}`}`
    : `<strong style="color:${C.soft};">${escapeHtml(BRAND.name)}</strong> &middot; SEO, AEO &amp; GEO for growing businesses<br>` +
      `${link("/", "Website")} &nbsp;&middot;&nbsp; ${link("/pricing", "Pricing")} &nbsp;&middot;&nbsp; ${link("/docs", "Help")} &nbsp;&middot;&nbsp; ${link("/contact", "Contact")}<br>` +
      `<a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:${C.muted};">${escapeHtml(BRAND.supportEmail)}</a><br>` +
      `&copy; ${new Date().getFullYear()} ${escapeHtml(BRAND.name)}. All rights reserved.`;
  const signatureText = b
    ? `${brandName}${b.hidePoweredBy ? "" : ` · Sent with ${BRAND.name}`}`
    : `${BRAND.name} · ${BRAND.supportEmail}\n${siteUrl()}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${title}</title>
<style>@media only screen and (max-width:620px){.card{padding:28px 22px !important}.outer{padding:20px 10px !important}.h1{font-size:20px !important;line-height:28px !important}}</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};font-family:${FONT};">
<tr><td align="center" class="outer" style="padding:36px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${FONT};">${headerLeft}</td><td align="right" style="font-family:${FONT};">${headerRight}</td></tr></table></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="4" bgcolor="${accent}" style="height:4px;line-height:4px;font-size:0;background:${accent};">&nbsp;</td></tr>
<tr><td class="card" style="padding:36px 40px;font-family:${FONT};">
<h1 class="h1" style="margin:0 0 18px 0;font-size:22px;line-height:30px;font-weight:700;color:${C.fg};letter-spacing:-0.2px;">${title}</h1>
${paragraphs}${cta}${signOff}
</td></tr></table>
</td></tr>
${help}
<tr><td align="center" style="padding:24px 12px 0 12px;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted};">${footer}${extraFooter ? `<br>${escapeHtml(extraFooter)}` : ""}<br><br>${signature}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    o.title,
    "",
    ...o.paragraphs.flatMap((p) => [p, ""]),
    ...(o.cta && ctaUrl ? [`${o.cta.label}: ${ctaUrl}`, ""] : []),
    "Warm regards,",
    `The ${brandName} team`,
    "",
    ...(b ? [] : [`Need help? Reply to this email or write to ${BRAND.supportEmail}.`, ""]),
    "--",
    footerRaw,
    ...(extraFooter ? [extraFooter] : []),
    signatureText,
  ].join("\n");

  return { html, text };
}
