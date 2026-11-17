// "Ready code": the exact code or file to paste, already filled in with the customer's real details (FixSite).
// Where a value is truly unknown there is ONE clearly marked placeholder and a note saying what to put there.
// Values are escaped for where they go: JSON-LD inside <script> (no "</script>" break-out) and HTML attributes.
// Pure (no I/O).
import type { FixPage } from "./types";
import type { FixSite } from "./site";

export interface ReadyCode {
  /** What it is, in plain words: "Business info for Google and AI". */
  label: string;
  code: string;
  /** What to fill in or check before pasting (null when nothing is missing). */
  note: string | null;
}

export const LOGO_PLACEHOLDER = "PASTE-THE-LINK-TO-YOUR-LOGO-HERE";

/** JSON for inside <script type="application/ld+json">: "<" is escaped so the text can never close the tag. */
export function jsonLdScript(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/** Escape text for an HTML attribute value or text node. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Plain text for one line of a text file (no line breaks, no Markdown link breakers). */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

function siteRoot(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}/`;
  } catch {
    return url;
  }
}

function describe(site: FixSite): string | null {
  if (site.sells) {
    const where = site.city ? ` in ${site.city}` : "";
    return oneLine(`${site.name}: ${site.sells}${where}.`).slice(0, 300);
  }
  return site.description ? oneLine(site.description).slice(0, 300) : null;
}

/** Business info for Google and AI (Organization, or LocalBusiness when the owner gave an address). */
export function organizationCode(site: FixSite): ReadyCode {
  const url = siteRoot(site.websiteUrl);
  const local = !!site.address;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": local ? "LocalBusiness" : "Organization",
    "@id": `${url}#organization`,
    name: site.name,
    url,
    logo: site.logo ?? LOGO_PLACEHOLDER,
  };
  const d = describe(site);
  if (d) data.description = d;
  if (site.sameAs.length) data.sameAs = site.sameAs;
  if (site.phone) data.telephone = site.phone;
  if (site.address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: site.address,
      ...(site.city ? { addressLocality: site.city } : {}),
      ...(site.country ? { addressCountry: site.country } : {}),
    };
  } else if (site.city) {
    data.areaServed = site.city;
  }
  if (site.founder) data.founder = { "@type": "Person", name: site.founder };
  if (local && site.logo) data.image = site.logo;
  const notes: string[] = [];
  if (!site.logo) notes.push(`Replace ${LOGO_PLACEHOLDER} with the link to your logo image (right-click your logo on your website → "Copy image address").`);
  if (!site.sameAs.length) notes.push("We found no links to your social profiles on your site. When you have them, add a \"sameAs\" list with their addresses.");
  if (!site.phone && !site.address) notes.push("Add your phone and address in Settings → My business, and this code will include them.");
  return { label: "Business info for Google and AI", code: jsonLdScript(data), note: notes.length ? notes.join(" ") : null };
}

/** The AI guide file (/llms.txt), listing the site's main pages. */
export function llmsTxtCode(site: FixSite, pages: { url: string; title: string | null; description?: string | null }[]): ReadyCode {
  const L: string[] = [`# ${oneLine(site.name)}`, ""];
  const d = describe(site);
  L.push(`> ${d ?? `${oneLine(site.name)} — ${siteRoot(site.websiteUrl)}`}`, "");
  const facts = [
    site.city && `Location: ${oneLine(site.city)}`,
    site.address && `Address: ${oneLine(site.address)}`,
    site.phone && `Phone: ${oneLine(site.phone)}`,
    site.services && `Services: ${oneLine(site.services)}`,
    site.customers && `Customers: ${oneLine(site.customers)}`,
  ].filter((x): x is string => !!x);
  if (facts.length) L.push(...facts.map((x) => `- ${x}`), "");
  const seen = new Set<string>();
  const main = pages.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return /^https?:\/\//.test(p.url);
  });
  if (main.length) {
    L.push("## Main pages", "");
    for (const p of main.slice(0, 20)) {
      const title = oneLine(p.title || p.url).replace(/[[\]]/g, "");
      const desc = p.description ? `: ${oneLine(p.description).slice(0, 140)}` : "";
      L.push(`- [${title}](${p.url})${desc}`);
    }
  }
  return {
    label: "Your AI guide file (save it as llms.txt)",
    code: L.join("\n").trim() + "\n",
    note: main.length ? "Check the list: remove any page you don't want AI tools to look at first." : "Add your most important pages as \"- [Name](address)\" lines.",
  };
}

/** Share preview tags for one page (WhatsApp, Facebook, LinkedIn). */
export function shareTagsCode(site: FixSite, page: FixPage, title: string): ReadyCode {
  const x = page.extracted;
  const desc = x?.description ?? describe(site) ?? null;
  const image = x?.openGraph?.image ?? site.logo;
  const tags = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    desc ? `<meta property="og:description" content="${escapeHtml(oneLine(desc).slice(0, 200))}">` : null,
    `<meta property="og:url" content="${escapeHtml(page.url)}">`,
    `<meta property="og:site_name" content="${escapeHtml(site.name)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:image" content="${escapeHtml(image ?? "PASTE-THE-LINK-TO-A-1200x630-PICTURE-HERE")}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter((t): t is string => !!t);
  return {
    label: "Share preview tags (paste inside <head>)",
    code: tags.join("\n"),
    note: image
      ? x?.openGraph?.image
        ? null
        : "We used your logo as the picture. A 1200×630 photo of your work or products looks better when shared."
      : "Replace the picture placeholder with the link to a 1200×630 picture of your business.",
  };
}
