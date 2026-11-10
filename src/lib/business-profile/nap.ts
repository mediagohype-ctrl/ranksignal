// NAP (name, address, phone) + website consistency: the Google Maps listing vs what the website itself says in its
// Organization/LocalBusiness schema and on its contact page (from the latest crawl). Pure (tested).
import { isOrgType } from "@/lib/crawler/extract";
import type { PlaceSnapshot } from "./places";

export interface SiteNap {
  name: string | null;
  phones: string[];
  address: string | null;
  postalCodes: string[];
  website: string | null;
  /** Page URLs we read this from. */
  sources: string[];
}

export interface CrawledPageLike {
  url: string;
  extracted: unknown;
}

const LEGAL = /\b(pvt|private|ltd|limited|llp|inc|incorporated|llc|co|company|corp|corporation|plc|the|opc)\b/g;

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparable phone: digits only, last 10 (drops +91 / 0 trunk prefixes for Indian numbers). */
export function normalizePhone(s: string | null | undefined): string | null {
  const d = (s ?? "").replace(/\D+/g, "");
  if (d.length < 6) return null;
  return d.length > 10 ? d.slice(-10) : d.replace(/^0+/, "");
}

export function postalCodesIn(s: string | null | undefined): string[] {
  return [...new Set((s ?? "").match(/\b\d{6}\b|\b\d{3}\s\d{3}\b|\b\d{5}(?:-\d{4})?\b/g)?.map((x) => x.replace(/\s/g, "")) ?? [])];
}

const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
export function phonesInText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    const n = normalizePhone(m);
    if (n && n.length >= 8 && n.length <= 12) out.add(n);
  }
  return [...out].slice(0, 10);
}

function walk(v: unknown, out: Record<string, unknown>[], depth = 0) {
  if (depth > 8 || v === null || typeof v !== "object" || out.length > 500) return;
  if (Array.isArray(v)) {
    for (const x of v.slice(0, 100)) walk(x, out, depth + 1);
    return;
  }
  const o = v as Record<string, unknown>;
  out.push(o);
  for (const [k, val] of Object.entries(o)) if (k !== "@context") walk(val, out, depth + 1);
}

const typesOf = (o: Record<string, unknown>) => {
  const t = o["@type"];
  const arr = typeof t === "string" ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
  return arr.map((x) => x.replace(/^https?:\/\/schema\.org\//, ""));
};
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null);

function addressText(a: unknown): string | null {
  if (typeof a === "string") return s(a);
  if (Array.isArray(a)) return addressText(a[0]);
  if (a && typeof a === "object") {
    const o = a as Record<string, unknown>;
    const parts = [o.streetAddress, o.addressLocality, o.addressRegion, o.postalCode, o.addressCountry]
      .map((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" ? s((x as Record<string, unknown>).name) : null))
      .filter((x): x is string => Boolean(x));
    return parts.length ? parts.join(", ").slice(0, 500) : null;
  }
  return null;
}

/** Read the business's own NAP from crawled pages: Organization/LocalBusiness JSON-LD first, then the contact page. */
export function siteNapFromPages(pages: CrawledPageLike[]): SiteNap {
  const nap: SiteNap = { name: null, phones: [], address: null, postalCodes: [], website: null, sources: [] };
  const phones = new Set<string>();
  const addSource = (u: string) => {
    if (!nap.sources.includes(u) && nap.sources.length < 5) nap.sources.push(u);
  };
  // Pages with an org node: prefer the home page, then contact/about.
  const rank = (u: string) => {
    try {
      const p = new URL(u).pathname.toLowerCase();
      return p === "/" || p === "" ? 0 : /contact/.test(p) ? 1 : /about/.test(p) ? 2 : 3;
    } catch {
      return 4;
    }
  };
  const sorted = [...pages].sort((a, b) => rank(a.url) - rank(b.url));
  for (const pg of sorted) {
    const ex = pg.extracted && typeof pg.extracted === "object" ? (pg.extracted as Record<string, unknown>) : {};
    const nodes: Record<string, unknown>[] = [];
    walk(Array.isArray(ex.jsonLd) ? ex.jsonLd : [], nodes);
    for (const n of nodes) {
      if (!typesOf(n).some(isOrgType)) continue;
      let used = false;
      if (!nap.name && s(n.name)) {
        nap.name = s(n.name);
        used = true;
      }
      const tel = normalizePhone(s(n.telephone));
      if (tel) {
        phones.add(tel);
        used = true;
      }
      if (!nap.address && n.address) {
        nap.address = addressText(n.address);
        used = Boolean(nap.address) || used;
      }
      if (!nap.website && s(n.url)) nap.website = s(n.url);
      if (used) addSource(pg.url);
    }
    if (rank(pg.url) === 1) {
      const text = typeof ex.textSample === "string" ? ex.textSample : "";
      const found = phonesInText(text);
      if (found.length) {
        found.forEach((p) => phones.add(p));
        addSource(pg.url);
      }
      if (!nap.address) {
        const pc = postalCodesIn(text);
        if (pc.length) nap.postalCodes.push(...pc);
      }
    }
  }
  nap.phones = [...phones].slice(0, 10);
  nap.postalCodes = [...new Set([...nap.postalCodes, ...postalCodesIn(nap.address)])].slice(0, 5);
  return nap;
}

export type NapStatus = "match" | "mismatch" | "missing_site" | "missing_profile";

export interface NapRow {
  field: "name" | "phone" | "address" | "website";
  label: string;
  profile: string | null;
  site: string | null;
  status: NapStatus;
  fix: string;
}

const hostOf = (u: string | null | undefined) => {
  if (!u) return null;
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

function tokens(s: string): Set<string> {
  return new Set(normalizeName(s).split(" ").filter((t) => t.length >= 3));
}

export function compareNap(place: PlaceSnapshot, site: SiteNap, projectWebsite?: string | null): NapRow[] {
  const rows: NapRow[] = [];
  const missingSite = (what: string) =>
    `Your website doesn't state its ${what} in a way we can read. Add it to your contact page and your Organization/LocalBusiness schema, written exactly as on Google.`;

  // Name
  {
    const a = normalizeName(place.name);
    const b = normalizeName(site.name);
    const status: NapStatus = !place.name ? "missing_profile" : !site.name ? "missing_site" : a === b || a.includes(b) || b.includes(a) ? "match" : "mismatch";
    rows.push({
      field: "name", label: "Business name", profile: place.name, site: site.name, status,
      fix: status === "mismatch" ? "Use the same business name on your website and Google. Small differences confuse Google and AI assistants about whether it's the same business." : status === "missing_site" ? missingSite("business name") : status === "missing_profile" ? "Add your business name to your Business Profile." : "",
    });
  }
  // Phone
  {
    const p = normalizePhone(place.phone ?? place.internationalPhone);
    const status: NapStatus = !p ? "missing_profile" : site.phones.length === 0 ? "missing_site" : site.phones.includes(p) ? "match" : "mismatch";
    rows.push({
      field: "phone", label: "Phone", profile: place.phone ?? place.internationalPhone, site: site.phones.join(", ") || null, status,
      fix: status === "mismatch" ? "The phone number on Google doesn't appear on your website. Show the same main number on both." : status === "missing_site" ? missingSite("phone number") : status === "missing_profile" ? "Add a phone number to your Business Profile." : "",
    });
  }
  // Address
  {
    const pcs = postalCodesIn(place.address);
    let status: NapStatus;
    if (!place.address) status = "missing_profile";
    else if (!site.address && site.postalCodes.length === 0) status = "missing_site";
    else if (pcs.length && site.postalCodes.length) status = pcs.some((c) => site.postalCodes.includes(c)) ? "match" : "mismatch";
    else if (site.address) {
      const a = tokens(place.address);
      const b = tokens(site.address);
      const shared = [...b].filter((t) => a.has(t)).length;
      status = b.size > 0 && shared / b.size >= 0.5 ? "match" : "mismatch";
    } else status = "missing_site";
    rows.push({
      field: "address", label: "Address", profile: place.address, site: site.address ?? (site.postalCodes.length ? `PIN ${site.postalCodes.join(", ")}` : null), status,
      fix: status === "mismatch" ? "The address on your website doesn't match Google (we compare the PIN code and street words). Write it the same way in both places." : status === "missing_site" ? missingSite("address") : status === "missing_profile" ? "Add your address (or service area) to your Business Profile." : "",
    });
  }
  // Website
  {
    const g = hostOf(place.website);
    const w = hostOf(projectWebsite ?? site.website);
    const status: NapStatus = !g ? "missing_profile" : !w ? "missing_site" : g === w || g.endsWith(`.${w}`) || w.endsWith(`.${g}`) ? "match" : "mismatch";
    rows.push({
      field: "website", label: "Website", profile: place.website, site: projectWebsite ?? site.website, status,
      fix: status === "mismatch" ? "Google links to a different website. Update the website link in your Business Profile." : status === "missing_profile" ? "Add your website to your Business Profile." : "",
    });
  }
  return rows;
}
