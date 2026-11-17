// Business names: the name the owner confirmed, the other names people use ("Go Hype Media", "GoHype"), and the
// names the website itself shows. Pure (no I/O) — used by setup, Settings, the brand checks and AI-answer parsing
// so a name guessed from the web address ("Gohypemedia") never reads as "your name is missing from every page".

const TITLE_SEP = /\s+[|–—•·:-]\s+|\s+-\s+/;
const GENERIC_PART = /^(home|homepage|welcome|official (web)?site|index|main page)$/i;

/** The title segment most like the domain ("Home | Sharma Sweets – Best mithai" → "Sharma Sweets"). */
export function nameFromTitle(title: string, host: string): string {
  const parts = title
    .split(TITLE_SEP)
    .map((p) => p.trim())
    .filter((p) => p && !GENERIC_PART.test(p) && p.length <= 60);
  if (!parts.length) return "";
  const hostKey = (host.split(".")[0] ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const key = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const match = hostKey ? parts.find((p) => key(p).includes(hostKey) || (key(p).length >= 4 && hostKey.includes(key(p)))) : undefined;
  return match ?? (parts.length > 1 ? parts.reduce((a, b) => (b.length < a.length ? b : a)) : parts[0]);
}

/** Letters and digits only, lowercased: "Go Hype-Media" → "gohypemedia". */
export function nameKey(s: string): string {
  return s.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/** First label of the site's host without "www.": "https://www.go-hype.co.in/x" → "go-hype". */
export function domainLabel(websiteUrl: string): string {
  try {
    const host = new URL(/^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`).hostname;
    return host.replace(/^www\./i, "").split(".")[0] ?? "";
  } catch {
    return "";
  }
}

/** True when the name is just the web address in other clothes ("Gohypemedia" for gohypemedia.com). */
export function isDomainDerivedName(name: string, websiteUrl: string): boolean {
  const a = nameKey(name);
  return !!a && a === nameKey(domainLabel(websiteUrl));
}

const MAX_SPLIT_WORDS = 4;

/**
 * Every way a name is commonly written: "Go Hype Media" → also "GoHype Media", "Go HypeMedia", "GoHypeMedia".
 * Matching is case-insensitive elsewhere, so "gohypemedia" is covered too. Order: given names first.
 */
export function brandNameVariants(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    const k = t.toLowerCase();
    if (t.length < 2 || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  const clean = names.filter((n) => typeof n === "string" && n.trim());
  for (const n of clean) add(n);
  for (const n of clean) {
    const words = n.trim().split(/[\s-]+/).filter(Boolean);
    if (words.length < 2) continue;
    if (words.length > MAX_SPLIT_WORDS) {
      add(words.join(""));
      continue;
    }
    // Each gap is either kept or closed: 2^(words-1) spellings.
    const gaps = words.length - 1;
    for (let mask = 1; mask < 1 << gaps; mask++) {
      let s = words[0];
      for (let i = 0; i < gaps; i++) s += (mask & (1 << i) ? "" : " ") + words[i + 1];
      add(s);
    }
  }
  return out.slice(0, 60);
}

/** "Go Hype Media, GoHype; gohype" → ["Go Hype Media", "GoHype"] (unique ignoring case, at most 19). */
export function parseAliases(raw: string, ownName = ""): string[] {
  const own = ownName.trim().toLowerCase();
  const seen = new Set<string>(own ? [own] : []);
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const t = part.replace(/\s+/g, " ").trim().slice(0, 120);
    const k = t.toLowerCase();
    if (t.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 19) break;
  }
  return out;
}

/** What we need from a crawled home page to read the name the site uses for itself. */
export interface NameSignalPage {
  title?: string | null;
  openGraph?: { siteName?: string | null } | null;
  organization?: { name?: string | null } | null;
  images?: { src: string; alt: string | null }[];
}

const okName = (s: unknown): s is string => typeof s === "string" && s.trim().length >= 2 && s.trim().length <= 60;

/** Names the website gives itself, best first: business info for Google, site name, the headline's brand part, logo text. */
export function siteNameSignals(page: NameSignalPage | null | undefined, websiteUrl: string): string[] {
  if (!page) return [];
  let host = "";
  try {
    host = new URL(websiteUrl).hostname.replace(/^www\./i, "");
  } catch {
    /* keep empty */
  }
  const logoAlt = (page.images ?? []).find((i) => /logo/i.test(i.src) && okName(i.alt))?.alt?.replace(/\s*\blogo\b\s*/i, " ");
  const raw = [page.organization?.name, page.openGraph?.siteName, page.title ? nameFromTitle(page.title, host) : "", logoAlt];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!okName(r)) continue;
    const t = r.replace(/\s+/g, " ").trim();
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** A site signal "belongs" to the address when one contains the other ("GoHype" inside "gohypemedia"). */
function relatedToDomain(name: string, websiteUrl: string): boolean {
  const a = nameKey(name);
  const d = nameKey(domainLabel(websiteUrl));
  return a.length >= 3 && d.length >= 3 && (a.includes(d) || d.includes(a));
}

/**
 * "Is your business called 'Go Hype Media'?" — the name the site itself uses, offered only while the saved name
 * is still the one guessed from the web address. Null when there is nothing better to offer.
 */
export function suggestedBusinessName(currentName: string, websiteUrl: string, home: NameSignalPage | null | undefined): string | null {
  if (!isDomainDerivedName(currentName, websiteUrl)) return null;
  const all = siteNameSignals(home, websiteUrl);
  // The site already writes the name exactly as saved: nothing better to offer.
  if (all.some((s) => s.toLowerCase() === currentName.trim().toLowerCase())) return null;
  const signals = all;
  // Prefer a properly written version of the same name ("Go Hype Media" for "Gohypemedia").
  return signals.find((s) => nameKey(s) === nameKey(currentName)) ?? signals.find((s) => relatedToDomain(s, websiteUrl)) ?? null;
}

/**
 * The names the brand checks look for. Always every saved name; while the main name is only a guess from the web
 * address (or nothing is saved), the site's own names are added so the check can't fail on our guess alone.
 */
export function namesForBrandChecks(names: string[], websiteUrl: string, home: NameSignalPage | null | undefined): string[] {
  const own = names.filter((n) => typeof n === "string" && n.trim().length >= 2);
  const guessed = own.length === 0 || own.every((n) => isDomainDerivedName(n, websiteUrl));
  if (!guessed) return own;
  const extra = siteNameSignals(home, websiteUrl).filter((s) => own.length === 0 || relatedToDomain(s, websiteUrl));
  const seen = new Set(own.map((n) => n.toLowerCase()));
  return [...own, ...extra.filter((s) => !seen.has(s.toLowerCase()))];
}
