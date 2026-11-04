// Pure website-address helpers for setup (client + server).

/** "acme.com" → "https://acme.com"; keeps an explicit http(s) scheme. */
export function normalizeWebsite(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Hostname without "www.", or null when it isn't a usable public-looking address. */
export function websiteHost(s: string): string | null {
  try {
    const u = new URL(normalizeWebsite(s));
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return host.includes(".") && !host.startsWith(".") && !host.endsWith(".") ? host : null;
  } catch {
    return null;
  }
}

/** Plain-words problem with a typed address, or null when it looks fine. */
export function websiteError(s: string): string | null {
  if (!s.trim()) return "Type your website address, for example sharmasweets.in";
  if (!websiteHost(s)) return "That doesn't look like a website address. Try something like sharmasweets.in";
  return null;
}

/**
 * The address to save: the page we actually landed on (after redirects) when it is the same site — so
 * "acme.com" becomes "https://www.acme.com/" — otherwise what the owner typed.
 */
export function preferredWebsite(typed: string, finalUrl: string | null | undefined): string {
  const t = normalizeWebsite(typed);
  if (!finalUrl) return t;
  const a = websiteHost(t);
  const b = websiteHost(finalUrl);
  if (!a || !b || a !== b) return t;
  try {
    const u = new URL(finalUrl);
    return `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return t;
  }
}
