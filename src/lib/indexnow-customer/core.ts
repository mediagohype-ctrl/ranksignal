// IndexNow for customers' sites — pure helpers (keys, URL filtering/dedupe/batching, change detection, responses).
// Mirrors the protocol used by src/lib/seo/indexnow.ts (our own site) without touching it.
import { randomBytes } from "node:crypto";
import { INDEXNOW_KEY_RE } from "@/lib/seo/indexnow";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Protocol limit per POST, and our per-host daily ceiling. */
export const MAX_URLS_PER_REQUEST = 10_000;
export const MAX_URLS_PER_HOST_PER_DAY = 10_000;
export const MAX_SUBMISSION_ATTEMPTS = 5;
/** Don't resend a URL that was accepted within this window. */
export const RESUBMIT_AFTER_MS = 24 * 60 * 60_000;

/** 32 hex characters (IndexNow allows 8–128 of a-z, A-Z, 0-9, "-"). */
export function generateIndexNowKey(): string {
  return randomBytes(16).toString("hex");
}

export function isValidKey(key: string): boolean {
  return INDEXNOW_KEY_RE.test(key);
}

/** Site origin + host from a project's website URL (https assumed when the scheme is missing). */
export function siteOf(websiteUrl: string): { origin: string; host: string } | null {
  const raw = websiteUrl.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return null;
    return { origin: u.origin, host: u.host.toLowerCase() };
  } catch {
    return null;
  }
}

export function keyFileUrl(origin: string, key: string): string {
  return `${origin}/${key}.txt`;
}

/** A served key file matches when its trimmed body is exactly the key (BOM tolerated). */
export function keyFileMatches(body: string, key: string): boolean {
  return body.replace(/^﻿/, "").trim() === key;
}

/**
 * Keep only absolute http(s) URLs on exactly `host` (IndexNow rejects other hosts with 422), drop fragments,
 * dedupe (order kept). `www.` and the bare domain are different hosts to IndexNow.
 */
export function filterUrlsForHost(urls: Iterable<string>, host: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const h = host.toLowerCase();
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    let u: URL;
    try {
      u = new URL(raw.trim());
    } catch {
      continue;
    }
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.host.toLowerCase() !== h || u.username || u.password) continue;
    u.hash = "";
    const s = u.toString();
    if (s.length > 2048 || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function chunk<T>(xs: T[], size = MAX_URLS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Plan a send: drop recently accepted URLs, then cap to what's left of today's per-host allowance. */
export function planBatch(o: { urls: string[]; recentlySent: Set<string>; sentToday: number; dailyCap?: number }): {
  send: string[];
  skippedRecent: string[];
  overCap: string[];
} {
  const cap = Math.max(0, (o.dailyCap ?? MAX_URLS_PER_HOST_PER_DAY) - o.sentToday);
  const fresh = o.urls.filter((u) => !o.recentlySent.has(u));
  const skippedRecent = o.urls.filter((u) => o.recentlySent.has(u));
  return { send: fresh.slice(0, cap), skippedRecent, overCap: fresh.slice(cap) };
}

export function buildPayload(o: { host: string; key: string; keyLocation: string; urls: string[] }) {
  return { host: o.host, key: o.key, keyLocation: o.keyLocation, urlList: o.urls };
}

export type ResponseKind = "accepted" | "retry" | "key_invalid" | "rejected";

/** IndexNow answers: 200/202 accepted · 400 bad request · 403 key not valid · 422 URLs not on host · 429 too many requests. */
export function classifyResponse(status: number): { kind: ResponseKind; message: string } {
  if (status === 200 || status === 202) return { kind: "accepted", message: status === 202 ? "Accepted; the key is still being checked by the search engines." : "Accepted." };
  if (status === 429) return { kind: "retry", message: "IndexNow asked us to slow down (429). We'll retry automatically." };
  if (status >= 500 || status === 408) return { kind: "retry", message: `IndexNow had a temporary problem (HTTP ${status}). We'll retry automatically.` };
  if (status === 403) return { kind: "key_invalid", message: "The search engines couldn't confirm your key file (403). Check that it's still on your site, then verify again." };
  if (status === 422) return { kind: "rejected", message: "Some URLs don't belong to this site's address (422)." };
  return { kind: "rejected", message: `IndexNow rejected the request (HTTP ${status}).` };
}

export interface PageVersion {
  url: string;
  statusCode: number | null;
  contentType: string | null;
  fingerprint: string | null;
}

/**
 * Pages worth announcing after a crawl: HTML pages that answer 200 now and are new or whose content fingerprint changed
 * since the previous crawl. With no previous crawl nothing is "changed" (a first crawl would announce the whole site).
 */
export function changedPages(previous: PageVersion[] | null, current: PageVersion[]): string[] {
  if (!previous || previous.length === 0) return [];
  const before = new Map(previous.map((p) => [p.url, p]));
  const out: string[] = [];
  for (const p of current) {
    if (p.statusCode !== 200 || !p.fingerprint) continue;
    if (p.contentType && !/html/i.test(p.contentType)) continue;
    const prev = before.get(p.url);
    if (!prev || prev.statusCode !== 200 || (prev.fingerprint && prev.fingerprint !== p.fingerprint)) out.push(p.url);
  }
  return out;
}
