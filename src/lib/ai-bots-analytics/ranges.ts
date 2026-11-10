// Published crawler IP ranges (OpenAI, Perplexity, Google, Bing). Fetched SSRF-safely from fixed vendor hosts, cached
// in memory for a day (failures for an hour). Optional: when a list can't be loaded, visits stay "claimed by user agent".
// Set AI_BOT_IP_VERIFY=false to never fetch.
import ipaddr from "ipaddr.js";
import { safeRequestJson } from "@/lib/net/safe-request";
import type { RangeSource } from "./bots";

export const RANGE_URLS: Record<RangeSource, string> = {
  "openai-gptbot": "https://openai.com/gptbot.json",
  "openai-searchbot": "https://openai.com/searchbot.json",
  "openai-chatgpt-user": "https://openai.com/chatgpt-user.json",
  "perplexity-bot": "https://www.perplexity.ai/perplexitybot.json",
  "perplexity-user": "https://www.perplexity.ai/perplexity-user.json",
  googlebot: "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  bingbot: "https://www.bing.com/toolbox/bingbot.json",
};

const OK_TTL_MS = 24 * 60 * 60_000;
const FAIL_TTL_MS = 60 * 60_000;
const MAX_PREFIXES = 20_000;

type Cidr = [ipaddr.IPv4 | ipaddr.IPv6, number];
interface Entry {
  at: number;
  cidrs: Cidr[] | null;
}

const g = globalThis as unknown as { __aiBotRanges?: Map<RangeSource, Entry> };
const cache = (g.__aiBotRanges ??= new Map());

/** Parse a vendor range document: { prefixes: [{ ipv4Prefix } | { ipv6Prefix }] }. Pure, exported for tests. */
export function parseRangeDocument(doc: unknown): Cidr[] {
  const prefixes = doc && typeof doc === "object" ? (doc as { prefixes?: unknown }).prefixes : null;
  if (!Array.isArray(prefixes)) return [];
  const out: Cidr[] = [];
  for (const p of prefixes.slice(0, MAX_PREFIXES)) {
    if (!p || typeof p !== "object") continue;
    const raw = (p as Record<string, unknown>).ipv4Prefix ?? (p as Record<string, unknown>).ipv6Prefix;
    if (typeof raw !== "string") continue;
    try {
      out.push(ipaddr.parseCIDR(raw.trim()));
    } catch {
      /* skip malformed prefix */
    }
  }
  return out;
}

/** Is `ip` inside any of the CIDRs? Pure. IPv4-mapped IPv6 addresses are compared as IPv4. */
export function ipInRanges(ip: string, cidrs: Cidr[]): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip.trim());
  } catch {
    return false;
  }
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) addr = (addr as ipaddr.IPv6).toIPv4Address();
  for (const [net, bits] of cidrs) {
    if (net.kind() !== addr.kind()) continue;
    if ((addr as ipaddr.IPv4).match(net as ipaddr.IPv4, bits)) return true;
  }
  return false;
}

export type Verification = "verified" | "unverified" | "claimed";

export interface RangeChecker {
  check(source: RangeSource | undefined, ip: string | null): Verification;
  /** Sources whose list loaded (for the page: "we checked GPTBot visits against OpenAI's published IPs"). */
  loaded(): RangeSource[];
}

async function load(source: RangeSource, fetchJson: typeof safeRequestJson): Promise<Cidr[] | null> {
  const hit = cache.get(source);
  const now = Date.now();
  if (hit && now - hit.at < (hit.cidrs ? OK_TTL_MS : FAIL_TTL_MS)) return hit.cidrs;
  const url = RANGE_URLS[source];
  let cidrs: Cidr[] | null = null;
  try {
    const res = await fetchJson(url, { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 2, allowedHosts: [new URL(url).hostname] });
    const parsed = res.ok ? parseRangeDocument(res.data) : [];
    cidrs = parsed.length ? parsed : null;
  } catch {
    cidrs = null;
  }
  cache.set(source, { at: now, cidrs });
  return cidrs;
}

/** Load the lists for `sources` (in parallel, cached) and return a synchronous checker. Never throws. */
export async function loadRangeChecker(sources: Iterable<RangeSource>, opts: { fetchJson?: typeof safeRequestJson } = {}): Promise<RangeChecker> {
  const lists = new Map<RangeSource, Cidr[]>();
  if (process.env.AI_BOT_IP_VERIFY !== "false") {
    const unique = [...new Set(sources)];
    const loaded = await Promise.all(unique.map((s) => load(s, opts.fetchJson ?? safeRequestJson)));
    unique.forEach((s, i) => {
      const c = loaded[i];
      if (c) lists.set(s, c);
    });
  }
  return {
    check(source, ip) {
      if (!source || !ip) return "claimed";
      const cidrs = lists.get(source);
      if (!cidrs) return "claimed";
      return ipInRanges(ip, cidrs) ? "verified" : "unverified";
    },
    loaded: () => [...lists.keys()],
  };
}

export function __resetRangeCacheForTests() {
  cache.clear();
}
