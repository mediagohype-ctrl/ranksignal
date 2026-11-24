// 24-hour in-memory cache of free-check results (per process), keyed by the website. A repeat check of the same
// site — the visitor coming back from the WhatsApp link, a refresh, a second try — is instant and doesn't count
// against the hourly limit.
import type { FreeCheckResult } from "@/lib/free-check/types";

export const FREE_CHECK_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

type Cached = Omit<FreeCheckResult, "leadId" | "benchmark">;
const cache = new Map<string, { at: number; item: Cached }>();

/** "https://www.Acme.com/" and "acme.com" share one entry. */
export function freeCheckCacheKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

export function getCachedFreeCheck(url: string, now = Date.now()): Cached | null {
  const key = freeCheckCacheKey(url);
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > FREE_CHECK_CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.item;
}

export function setCachedFreeCheck(urls: string[], item: FreeCheckResult, now = Date.now()): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { leadId, benchmark, ...rest } = item;
  for (const u of new Set(urls.map(freeCheckCacheKey))) {
    cache.delete(u);
    cache.set(u, { at: now, item: rest });
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Tests only. */
export function clearFreeCheckCache(): void {
  cache.clear();
}
