// URL validation for the public free check. Normalises what people type ("acme.com") and rejects
// anything that is not a public http(s) website (SSRF guard via assertPublicUrl).
import { assertPublicUrl, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { normalizeUrl } from "@/lib/crawler/normalize";

export type UrlValidation = { ok: true; url: string } | { ok: false; code: "invalid_url" | "blocked_url"; message: string };

const MAX_URL_LENGTH = 2048;

/** Sync step: trim, add https:// when no scheme was typed, normalise. Returns null if unusable. */
export function normalizeInputUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || s.length > MAX_URL_LENGTH || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    // Reject other schemes written without slashes (javascript:, data:, mailto:) — but allow host:port.
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return null;
    s = `https://${s}`;
  }
  const n = normalizeUrl(s);
  if (!n) return null;
  const u = new URL(n);
  if (!u.hostname.includes(".") && !u.hostname.startsWith("[")) return null;
  return n;
}

/** Full validation including DNS resolution to a public address. */
export async function validateFreeCheckUrl(raw: unknown): Promise<UrlValidation> {
  const url = normalizeInputUrl(raw);
  if (!url) return { ok: false, code: "invalid_url", message: "Enter a website address like example.com." };
  try {
    await assertPublicUrl(url);
    return { ok: true, url };
  } catch (e) {
    if (e instanceof SafeFetchError && e.code === "dns_failed") {
      return { ok: false, code: "invalid_url", message: "We couldn't find that website. Check the address and try again." };
    }
    if (e instanceof SafeFetchError && e.code === "invalid_url") {
      return { ok: false, code: "invalid_url", message: "Enter a website address like example.com." };
    }
    return { ok: false, code: "blocked_url", message: "That address isn't a public website we can check." };
  }
}
