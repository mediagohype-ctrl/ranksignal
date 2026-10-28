// SSRF-safe HTTP fetcher (blueprint §5, §11). Every fetch of a customer-supplied URL MUST go
// through safeFetch: scheme/port allow-list, DNS resolution with private-range rejection, the
// socket pinned to the validated IP (defeats DNS rebinding), manual redirect re-validation,
// timeouts and a decompressed byte cap.
import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import ipaddr from "ipaddr.js";
import { BRAND } from "@/lib/brand";

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked"
  | "dns_failed"
  | "timeout"
  | "too_large"
  | "too_many_redirects"
  | "network";

export class SafeFetchError extends Error {
  constructor(public code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
  /** Permanent errors will not succeed on retry (policy/validation failures). */
  get permanent(): boolean {
    return this.code === "invalid_url" || this.code === "blocked" || this.code === "too_many_redirects";
  }
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  headers: Headers;
  /** Decoded body for text-like content types; "" otherwise. Untrusted. */
  body: string;
  /** URLs that issued a redirect, in order (excludes finalUrl). length = number of hops. */
  redirectChain: string[];
}

export const USER_AGENT = `RankSignalBot/1.0 (+${BRAND.appUrl.replace(/\/$/, "")}/bot)`;
export const BOT_TOKEN = "RankSignalBot";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

const METADATA_IPS = new Set(["169.254.169.254", "fd00:ec2::254", "100.100.100.200", "168.63.129.16"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"];

/** True when the IP must never be contacted (non-public, metadata, malformed). */
export function isBlockedIp(ip: string): boolean {
  let raw = ip.trim();
  if (raw.startsWith("[") && raw.endsWith("]")) raw = raw.slice(1, -1);
  const zone = raw.indexOf("%");
  if (zone !== -1) return true; // zone-scoped IPv6 is always link-local
  if (!ipaddr.isValid(raw)) return true;
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    // process() unwraps IPv4-mapped IPv6 (::ffff:127.0.0.1 → 127.0.0.1).
    addr = ipaddr.process(raw);
  } catch {
    return true;
  }
  const normalized = addr.kind() === "ipv6" ? (addr as ipaddr.IPv6).toNormalizedString() : addr.toString();
  if (METADATA_IPS.has(addr.toString()) || METADATA_IPS.has(normalized)) return true;
  if (addr.kind() === "ipv4") {
    // Only strict four-part dotted decimal reaches here after URL parsing / DNS.
    return addr.range() !== "unicast";
  }
  const v6 = addr as ipaddr.IPv6;
  if (v6.range() !== "unicast") return true; // covers loopback, linkLocal, uniqueLocal, 6to4, teredo, NAT64...
  // Deprecated site-local fec0::/10 is reported as unicast by ipaddr.js.
  if (v6.match(ipaddr.IPv6.parseCIDR("fec0::/10"))) return true;
  return false;
}

function isAllowedPort(url: URL): boolean {
  if (url.port === "") return true;
  if (process.env.ALLOW_ANY_PORT === "true" || process.env.ALLOW_ANY_PORT === "1") return true;
  return url.port === "80" || url.port === "443";
}

export interface ValidatedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

/**
 * Validate that a URL is safe to fetch and resolve it to a public IP.
 * Throws SafeFetchError("invalid_url" | "blocked" | "dns_failed").
 */
export async function assertPublicUrl(input: string | URL): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  } catch {
    throw new SafeFetchError("invalid_url", "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", `Scheme ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) throw new SafeFetchError("invalid_url", "Credentials in URLs are not allowed");
  if (!isAllowedPort(url)) throw new SafeFetchError("blocked", `Port ${url.port} is not allowed`);

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new SafeFetchError("invalid_url", "Missing host");
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new SafeFetchError("blocked", "Host is not publicly routable");
  }

  // IP literal (WHATWG URL already canonicalises decimal/hex/octal IPv4 forms to dotted quad).
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (ipaddr.isValid(literal) && (literal.includes(":") || ipaddr.IPv4.isValidFourPartDecimal(literal))) {
    if (isBlockedIp(literal)) throw new SafeFetchError("blocked", "Address is not publicly routable");
    const family = literal.includes(":") ? 6 : 4;
    return { url, address: literal, family };
  }
  if (!host.includes(".")) throw new SafeFetchError("blocked", "Single-label hosts are not allowed");

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dnsLookup(host, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError("dns_failed", `Could not resolve ${host}`);
  }
  if (addresses.length === 0) throw new SafeFetchError("dns_failed", `No addresses for ${host}`);
  // Reject if ANY resolved address is non-public (prevents mixed-record tricks).
  for (const a of addresses) {
    if (isBlockedIp(a.address)) throw new SafeFetchError("blocked", "Host resolves to a non-public address");
  }
  const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
  return { url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

const TEXT_TYPES = /^(text\/html|application\/xhtml\+xml|text\/xml|application\/xml|application\/[a-z0-9.+-]*\+xml|text\/plain|application\/json|application\/ld\+json|application\/[a-z0-9.+-]*\+json)$/i;

function isDecodableType(contentType: string | null): boolean {
  if (!contentType) return true; // many servers omit it for robots.txt; size cap still applies
  const mime = contentType.split(";")[0].trim();
  return TEXT_TYPES.test(mime);
}

function decode(buf: Buffer, contentType: string | null): string {
  const m = contentType ? /charset=["']?([\w-]+)/i.exec(contentType) : null;
  const charset = m ? m[1].toLowerCase() : "utf-8";
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }
}

interface RawResponse {
  status: number;
  headers: Headers;
  body: string;
  location: string | null;
}

function toHeaders(h: http.IncomingHttpHeaders): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) out.append(k, item);
    else out.set(k, String(v));
  }
  return out;
}

function requestOnce(target: ValidatedTarget, deadline: number, maxBytes: number): Promise<RawResponse> {
  const { url, address, family } = target;
  const isHttps = url.protocol === "https:";
  const mod = isHttps ? https : http;
  const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;

  // Pin the socket to the validated address regardless of what DNS says now.
  const pinnedLookup = ((_h: string, opts: { all?: boolean } | number | undefined, cb: unknown) => {
    const callback = (typeof opts === "function" ? opts : cb) as (...args: unknown[]) => void;
    const all = typeof opts === "object" && opts !== null && opts.all;
    if (all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;

  return new Promise<RawResponse>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("timeout", "Request timed out"));
    let settled = false;
    const fail = (err: SafeFetchError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      reject(err);
    };

    const req = mod.request(
      {
        protocol: url.protocol,
        hostname, // Host header + TLS SNI use the real hostname
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        lookup: pinnedLookup,
        agent: false,
        servername: isHttps && !ipaddr.isValid(hostname) ? hostname : undefined,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en;q=0.9,*;q=0.5",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = toHeaders(res.headers);
        const location = status >= 300 && status < 400 ? (res.headers.location ?? null) : null;
        const contentType = res.headers["content-type"] ?? null;
        if (location || !isDecodableType(contentType) || status === 204 || status === 304) {
          res.resume();
          settled = true;
          clearTimeout(timer);
          req.destroy();
          return resolve({ status, headers, body: "", location });
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > maxBytes * 2) {
          return fail(new SafeFetchError("too_large", `Response exceeds ${maxBytes} bytes`));
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding.includes("br")) stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding.includes("gzip")) stream = res.pipe(zlib.createGunzip());
        else if (encoding.includes("deflate")) stream = res.pipe(zlib.createInflate());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length; // counts decompressed bytes → zip-bomb safe
          if (size > maxBytes) return fail(new SafeFetchError("too_large", `Response exceeds ${maxBytes} bytes`));
          chunks.push(chunk);
        });
        stream.on("error", () => fail(new SafeFetchError("network", "Failed to read response body")));
        stream.on("end", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status, headers, body: decode(Buffer.concat(chunks), contentType), location: null });
        });
      },
    );
    const timer = setTimeout(() => fail(new SafeFetchError("timeout", "Request timed out")), remaining);
    req.on("error", (e: NodeJS.ErrnoException) => {
      fail(new SafeFetchError("network", `Network error${e.code ? ` (${e.code})` : ""}`));
    });
    req.end();
  });
}

/** SSRF-safe GET. Re-validates every redirect hop. See module header. */
export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const deadline = Date.now() + timeoutMs;
  const chain: string[] = [];
  let current = url;

  for (let hop = 0; ; hop++) {
    const target = await assertPublicUrl(current);
    target.url.hash = "";
    const res = await requestOnce(target, deadline, maxBytes);
    if (res.location) {
      if (hop >= maxRedirects) throw new SafeFetchError("too_many_redirects", `More than ${maxRedirects} redirects`);
      let next: URL;
      try {
        next = new URL(res.location, target.url);
      } catch {
        throw new SafeFetchError("invalid_url", "Invalid redirect location");
      }
      chain.push(target.url.toString());
      current = next.toString();
      continue;
    }
    return { finalUrl: target.url.toString(), status: res.status, headers: res.headers, body: res.body, redirectChain: chain };
  }
}
