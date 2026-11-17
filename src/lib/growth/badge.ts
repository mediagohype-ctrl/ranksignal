// Public score badge (brief §9): an SVG "Found Score 82" that links back to MyWebRank. Pure renderer; the route
// (src/app/badge/[file]/route.ts) checks the badge token and reads the stored score.
import { BRAND } from "@/lib/brand";

/** The product's score name, the same as on pricing and the free check. */
export const BADGE_LABEL = "Found Score";

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(v: string): string {
  // Also drop control characters that are invalid in XML 1.0.
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!);
}

/** Same bands as the app: 75+ green, 50–74 yellow, under 50 red, not measured grey. */
export function badgeColor(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return "#6b7185";
  if (score >= 75) return "#1a7f45";
  if (score >= 50) return "#a35f00";
  return "#c02b2b";
}

/** Rough text width for 11px Verdana (shields.io style), so the badge sizes itself without measuring a font. */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[A-Z0-9mwMW]/.test(ch) ? 7.5 : /[il.:, ]/.test(ch) ? 3.5 : 6.2;
  return Math.ceil(w);
}

export function renderBadgeSvg(o: { score: number | null; label?: string; link?: string }): string {
  const label = (o.label ?? BADGE_LABEL).slice(0, 40);
  const value =
    o.score === null || !Number.isFinite(o.score) ? "not checked" : String(Math.max(0, Math.min(100, Math.round(o.score))));
  const link = o.link ?? BRAND.appUrl;
  const lw = textWidth(label) + 14;
  const vw = textWidth(value) + 14;
  const w = lw + vw;
  const title = escapeXml(`${label}: ${value}, checked by ${BRAND.name}`);
  const href = escapeXml(link);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="20" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<a xlink:href="${href}" href="${href}" target="_blank">`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#151a2d"/><rect x="${lw}" width="${vw}" height="20" fill="${badgeColor(o.score)}"/><rect width="${w}" height="20" fill="url(#s)"/></g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${lw / 2}" y="14">${escapeXml(label)}</text>`,
    `<text x="${lw + vw / 2}" y="14" font-weight="bold">${escapeXml(value)}</text>`,
    `</g>`,
    `</a>`,
    `</svg>`,
  ].join("\n");
}

/**
 * Public URLs + embed HTML for a project's badge (token = the badge token). The link goes through /badge/<token>,
 * which opens the shared report while sharing is on and our home page otherwise — so it never dead-ends.
 * rel="nofollow": Google asks for widget / badge links to be nofollow.
 */
export function badgeUrls(o: { token: string; appUrl?: string }) {
  const base = (o.appUrl ?? BRAND.appUrl).replace(/\/$/, "");
  const svg = `${base}/badge/${encodeURIComponent(o.token)}.svg`;
  const report = `${base}/badge/${encodeURIComponent(o.token)}`;
  const html = `<a href="${escapeXml(report)}" target="_blank" rel="nofollow noopener"><img src="${escapeXml(svg)}" alt="${BADGE_LABEL}, checked by ${escapeXml(BRAND.name)}" height="20"></a>`;
  return { svg, report, html };
}
