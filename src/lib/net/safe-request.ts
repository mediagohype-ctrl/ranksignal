// SSRF-safe HTTP client for connectors (any method + body). Generalises the pinned-IP approach of
// src/lib/crawler/safe-fetch.ts: scheme/port allow-list, DNS resolution with private-range rejection,
// the socket pinned to the validated IP (defeats DNS rebinding), NO redirects by default (opt-in and
// re-validated per hop, credentials dropped cross-origin), a hard timeout and a decompressed byte cap.
//
// Every outbound call to a customer-supplied host — and to fixed vendor API hosts (api.github.com,
// *.myshopify.com, ...) — goes through safeRequest. This module never logs; if you log a request,
// pass its headers through redactHeaders() first.
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import ipaddr from "ipaddr.js";
import { assertPublicUrl, SafeFetchError, USER_AGENT, type ValidatedTarget } from "@/lib/crawler/safe-fetch";

export { SafeFetchError as SafeRequestError };

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface SafeRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** Whole-request deadline including DNS + body (default 15s). */
  timeoutMs?: number;
  /** Cap on the DECOMPRESSED response body (default 5 MB). */
  maxBytes?: number;
  /** Redirects to follow (default 0 = return the 3xx response as-is). Each hop is re-validated. */
  maxRedirects?: number;
  /**
   * Optional host allow-list, e.g. ["api.github.com"] or ["*.myshopify.com"]. Requests (and redirect
   * hops) to any other host are refused. Use it for fixed vendor APIs.
   */
  allowedHosts?: string[];
}

export interface SafeRequestResult {
  status: number;
  headers: Headers;
  /** Response body decoded as UTF-8 (untrusted). "" for HEAD/204/304. */
  body: string;
  /** URL of the response (differs from the request URL only when redirects were followed). */
  url: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-shopify-access-token|.*(secret|token|password|key).*)$/i;

/** Copy of headers safe to log: values of auth-like headers replaced with "[redacted]". */
export function redactHeaders(h: Record<string, string> | Headers | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const entries = h instanceof Headers ? Array.from(h.entries()) : Object.entries(h);
  for (const [k, v] of entries) out[k] = SENSITIVE_HEADER.test(k) ? "[redacted]" : v;
  return out;
}

export function hostAllowed(host: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const h = host.toLowerCase().replace(/\.$/, "");
  return allowed.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.startsWith("*.")) return h.endsWith(p.slice(1)) && h.length > p.length - 1;
    return h === p;
  });
}

// ---- Test seam: tests swap the resolver to point a hostname at a local server. Never used in app code.
type Resolver = (url: string) => Promise<ValidatedTarget>;
let resolver: Resolver = (u) => assertPublicUrl(u);
export const __testing = {
  setResolver(fn: Resolver | null) {
    resolver = fn ?? ((u) => assertPublicUrl(u));
  },
};

function toHeaders(h: http.IncomingHttpHeaders): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) out.append(k, item);
    else out.set(k, String(v));
  }
  return out;
}

interface RawResponse {
  status: number;
  headers: Headers;
  body: string;
  location: string | null;
}

function requestOnce(
  target: ValidatedTarget,
  o: { method: HttpMethod; headers: Record<string, string>; body?: Uint8Array; deadline: number; maxBytes: number; wantRedirect: boolean },
): Promise<RawResponse> {
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
    const remaining = o.deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("timeout", "Request timed out"));
    let settled = false;
    const fail = (err: SafeFetchError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      reject(err);
    };
    const done = (r: RawResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      "accept-encoding": "gzip, deflate, br",
      ...lowerKeys(o.headers),
    };
    if (o.body) headers["content-length"] = String(o.body.byteLength);

    const req = mod.request(
      {
        protocol: url.protocol,
        hostname, // Host header + TLS SNI use the real hostname
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: o.method,
        lookup: pinnedLookup,
        agent: false,
        servername: isHttps && !ipaddr.isValid(hostname) ? hostname : undefined,
        headers,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const resHeaders = toHeaders(res.headers);
        const location = status >= 300 && status < 400 ? (res.headers.location ?? null) : null;
        if ((location && o.wantRedirect) || o.method === "HEAD" || status === 204 || status === 304) {
          res.resume();
          req.destroy();
          return done({ status, headers: resHeaders, body: "", location });
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > o.maxBytes * 2) {
          return fail(new SafeFetchError("too_large", `Response exceeds ${o.maxBytes} bytes`));
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
          size += chunk.length; // decompressed bytes → zip-bomb safe
          if (size > o.maxBytes) return fail(new SafeFetchError("too_large", `Response exceeds ${o.maxBytes} bytes`));
          chunks.push(chunk);
        });
        stream.on("error", () => fail(new SafeFetchError("network", "Failed to read response body")));
        stream.on("end", () =>
          done({ status, headers: resHeaders, body: Buffer.concat(chunks).toString("utf8"), location }),
        );
      },
    );
    const timer = setTimeout(() => fail(new SafeFetchError("timeout", "Request timed out")), remaining);
    // Error messages carry only the errno code — never the URL query, headers or body.
    req.on("error", (e: NodeJS.ErrnoException) => fail(new SafeFetchError("network", `Network error${e.code ? ` (${e.code})` : ""}`)));
    if (o.body) req.write(o.body);
    req.end();
  });
}

function lowerKeys(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}

/**
 * SSRF-safe request with any method/body. Throws SafeFetchError ("invalid_url" | "blocked" |
 * "dns_failed" | "timeout" | "too_large" | "too_many_redirects" | "network"). Non-2xx statuses are
 * returned, not thrown.
 */
export async function safeRequest(url: string, opts: SafeRequestOptions = {}): Promise<SafeRequestResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? 0;
  const deadline = Date.now() + timeoutMs;
  let method: HttpMethod = opts.method ?? "GET";
  let headers = { ...(opts.headers ?? {}) };
  let body: Uint8Array | undefined =
    opts.body === undefined ? undefined : typeof opts.body === "string" ? Buffer.from(opts.body, "utf8") : opts.body;
  let current = url;
  let origin: string | null = null;

  for (let hop = 0; ; hop++) {
    const target = await resolver(current);
    if (!hostAllowed(target.url.hostname, opts.allowedHosts)) {
      throw new SafeFetchError("blocked", "Host is not on this connector's allow-list");
    }
    target.url.hash = "";
    if (origin === null) origin = target.url.origin;
    const res = await requestOnce(target, { method, headers, body, deadline, maxBytes, wantRedirect: maxRedirects > 0 });
    if (res.location && maxRedirects > 0) {
      if (hop >= maxRedirects) throw new SafeFetchError("too_many_redirects", `More than ${maxRedirects} redirects`);
      let next: URL;
      try {
        next = new URL(res.location, target.url);
      } catch {
        throw new SafeFetchError("invalid_url", "Invalid redirect location");
      }
      // 301/302/303 → GET without body (browser semantics); 307/308 keep method + body.
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET" && method !== "HEAD")) {
        method = "GET";
        body = undefined;
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !/^content-(type|length)$/i.test(k)));
      }
      // Never forward credentials to a different origin.
      if (next.origin !== origin) {
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !SENSITIVE_HEADER.test(k)));
      }
      current = next.toString();
      continue;
    }
    return { status: res.status, headers: res.headers, body: res.body, url: target.url.toString() };
  }
}

export interface SafeJsonOptions extends Omit<SafeRequestOptions, "body"> {
  /** Serialised as the JSON request body (sets content-type). */
  json?: unknown;
}

export interface SafeJsonResult<T> extends SafeRequestResult {
  /** Parsed JSON body, or null when empty / not JSON. Untrusted. */
  data: T | null;
  ok: boolean;
}

/** safeRequest with a JSON body/response. Never throws on non-2xx; check `ok`/`status`. */
export async function safeRequestJson<T = unknown>(url: string, opts: SafeJsonOptions = {}): Promise<SafeJsonResult<T>> {
  const { json, ...rest } = opts;
  const headers: Record<string, string> = { accept: "application/json", ...(rest.headers ?? {}) };
  if (json !== undefined) headers["content-type"] = "application/json";
  const res = await safeRequest(url, { ...rest, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  let data: T | null = null;
  if (res.body) {
    try {
      data = JSON.parse(res.body) as T;
    } catch {
      data = null;
    }
  }
  return { ...res, data, ok: res.status >= 200 && res.status < 300 };
}
