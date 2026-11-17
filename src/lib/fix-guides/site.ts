// What we already know about the customer's business and website, gathered once for the fix guides so ready-to-paste
// code and suggested text use REAL details (website address, name, logo, social profiles, confirmed facts) instead of
// blanks like "YOUR WEBSITE ADDRESS". Pure (no I/O): the server loader passes in stored crawl pages and Project.facts.
import type { ExtractedPage } from "@/lib/types";
import type { Platform } from "@/lib/platform/detect";

export interface FixSite {
  websiteUrl: string;
  /** Business name customers know (the confirmed one when there is one). */
  name: string;
  description: string | null;
  /** Absolute link to a logo image found on the site; null = unknown. */
  logo: string | null;
  /** Official profile links found on the site (LinkedIn, Instagram, Facebook, X, YouTube…). */
  sameAs: string[];
  sells: string | null;
  customers: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2 ("IN"). */
  country: string | null;
  address: string | null;
  phone: string | null;
  founder: string | null;
  services: string | null;
  /** Sells online (shop platform, product pages or product info for Google). */
  isStore: boolean;
}

export interface FixSitePage {
  url: string;
  extracted: ExtractedPage | null;
}

const PROFILE_HOSTS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "facebook"],
  [/(^|\.)(x|twitter)\.com$/, "x"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)wikidata\.org$|(^|\.)wikipedia\.org$/, "wiki"],
];
/** Share buttons and other links that are not a profile. */
const NOT_PROFILE = /\/(sharer|share|intent|sharearticle|dialog|plugins|hashtag|watch|embed|p\/|reel\/|status\/|posts\/|search)/i;

/** Official profile links: one per platform, share buttons and single posts left out. Pure. */
export function profileLinks(urls: string[]): string[] {
  const out = new Map<string, string>();
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
    const kind = PROFILE_HOSTS.find(([re]) => re.test(host))?.[1];
    if (!kind || out.has(kind) || NOT_PROFILE.test(u.pathname + "/") || u.pathname.replace(/\/+$/, "") === "") continue;
    u.hash = "";
    u.search = "";
    u.protocol = "https:";
    out.set(kind, u.toString().replace(/\/+$/, ""));
  }
  return Array.from(out.values()).slice(0, 8);
}

function absolute(src: string | null | undefined, base: string): string | null {
  if (!src || typeof src !== "string") return null;
  try {
    const u = new URL(src.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const isHomeUrl = (u: string) => {
  try {
    return new URL(u).pathname.replace(/\/+$/, "") === "";
  } catch {
    return false;
  }
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Product pages and shop platforms mean an online store. */
export function looksLikeStore(pages: FixSitePage[], platform?: Platform | null): boolean {
  if (platform === "shopify") return true;
  return pages.some((p) => {
    const types = p.extracted?.schemaTypes ?? [];
    if (types.includes("Product") || types.includes("Offer")) return true;
    try {
      return /\/(products?|shop|store|collections?)(\/|$)/i.test(new URL(p.url).pathname);
    } catch {
      return false;
    }
  });
}

export function buildFixSite(o: {
  websiteUrl: string;
  name: string;
  /** Project.facts (what the owner confirmed). */
  facts?: unknown;
  /** Stored pages of the last website check (home page first is best, but not required). */
  pages: FixSitePage[];
  platform?: Platform | null;
}): FixSite {
  const f = o.facts && typeof o.facts === "object" && !Array.isArray(o.facts) ? (o.facts as Record<string, unknown>) : {};
  const ok = o.pages.filter((p) => p.extracted);
  const home = ok.find((p) => isHomeUrl(p.url)) ?? ok[0] ?? null;
  const hx = home?.extracted ?? null;
  const base = home?.url ?? o.websiteUrl;
  const org = hx?.organization ?? ok.map((p) => p.extracted!.organization).find((x) => !!x) ?? null;
  const logoImg = hx?.images.find((i) => /logo/i.test(i.src) || /logo/i.test(i.alt ?? ""))?.src ?? null;
  const logo = absolute(org?.logo, base) ?? absolute(logoImg, base) ?? absolute(hx?.openGraph?.image, base);
  const sameAs = profileLinks([...(org?.sameAs ?? []), ...ok.flatMap((p) => p.extracted!.socialLinks ?? [])]);
  return {
    websiteUrl: o.websiteUrl,
    name: str(f.name) ?? o.name,
    description: str(f.sells) ? null : (str(hx?.description) ?? str(hx?.openGraph?.description)),
    logo,
    sameAs,
    sells: str(f.sells),
    customers: str(f.customers),
    city: str(f.city),
    country: str(f.country),
    address: str(f.address),
    phone: str(f.phone) ?? str(org?.telephone),
    founder: str(f.founder),
    services: str(f.services),
    isStore: looksLikeStore(ok, o.platform),
  };
}
