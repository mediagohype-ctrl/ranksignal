// What a website is built with, read from its HTML (and response headers when we have them). Used to give fix
// steps for the customer's actual platform. Pure: no network.

export const PLATFORMS = ["nextjs", "react", "wordpress", "shopify", "wix", "webflow", "framer", "squarespace", "custom"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  nextjs: "Next.js",
  react: "React (Vite / Create React App)",
  wordpress: "WordPress",
  shopify: "Shopify",
  wix: "Wix",
  webflow: "Webflow",
  framer: "Framer",
  squarespace: "Squarespace",
  custom: "Custom code / other",
};

/** Platforms where the owner edits code (fixes come with a prompt for an AI coding assistant). */
export const CODE_PLATFORMS: readonly Platform[] = ["nextjs", "react", "custom"];

export const isPlatform = (v: unknown): v is Platform => typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);

type Headers = Record<string, string | string[] | undefined>;

const header = (h: Headers | undefined, name: string) => {
  const v = h?.[name] ?? h?.[name.toLowerCase()];
  return (Array.isArray(v) ? v.join(" ") : (v ?? "")).toLowerCase();
};

/** Ordered: site builders first (they can sit on top of React), then frameworks, then plain single-page apps. */
export function detectPlatform(html: string, headers?: Headers): Platform | null {
  const h = html.slice(0, 600_000);
  const generator = (h.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] ?? "").toLowerCase();
  const powered = header(headers, "x-powered-by");

  if (/framer/.test(generator) || /framerusercontent\.com|data-framer-/i.test(h)) return "framer";
  if (/wix\.com/.test(generator) || /static\.wixstatic\.com|static\.parastorage\.com/i.test(h) || header(headers, "x-wix-request-id")) return "wix";
  if (/webflow/.test(generator) || /data-wf-site=|data-wf-page=/i.test(h)) return "webflow";
  if (/squarespace/.test(generator) || /static1\.squarespace\.com|Static\.SQUARESPACE_CONTEXT/i.test(h)) return "squarespace";
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(h) || header(headers, "x-shopid")) return "shopify";
  if (/wordpress/.test(generator) || /\/wp-content\/|\/wp-includes\/|wp-json/i.test(h)) return "wordpress";
  if (/next\.js/.test(powered) || /\/_next\/static\/|id=["']__NEXT_DATA__["']|self\.__next_f/i.test(h)) return "nextjs";
  if (/<div id=["'](root|app)["']\s*>\s*<\/div>/i.test(h) || /\/static\/js\/main\.[a-f0-9]+\.js|<script[^>]+type=["']module["'][^>]+\/assets\/index-[\w-]+\.js/i.test(h)) {
    return "react";
  }
  return null;
}
