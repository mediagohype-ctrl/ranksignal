// Ad attribution: the UTM tags and fbclid from the page a visitor landed on, kept for the browser session so the
// lead record (free check, WhatsApp number) shows which ad it came from. Pure helpers + a tiny browser store.
import { z } from "zod";

export const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;
export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number] | "landing", string>>;

const STORE_KEY = "mwr_attr";

export const attributionSchema = z
  .object(Object.fromEntries([...ATTRIBUTION_KEYS, "landing"].map((k) => [k, z.string().max(500).optional()])) as Record<string, z.ZodOptional<z.ZodString>>)
  .strip()
  .optional();

/** Tags present in a URL's query string (null when there are none). */
export function attributionFrom(href: string): Attribution | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const out: Attribution = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = u.searchParams.get(k)?.trim();
    if (v) out[k] = v.slice(0, 500);
  }
  if (Object.keys(out).length === 0) return null;
  out.landing = `${u.pathname}`.slice(0, 500);
  return out;
}

/** Browser: remember the first tagged landing of this session (a later untagged page doesn't wipe it). */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const found = attributionFrom(window.location.href);
    if (found && !window.sessionStorage.getItem(STORE_KEY)) window.sessionStorage.setItem(STORE_KEY, JSON.stringify(found));
  } catch {
    /* storage blocked: attribution is best-effort */
  }
}

/** Browser: the session's attribution, or undefined. */
export function readAttribution(): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === "object") return parsed as Attribution;
  } catch {
    /* ignore */
  }
  // Not stored yet (storage blocked, or this page is the landing): read the current URL directly.
  return attributionFrom(window.location.href) ?? undefined;
}
