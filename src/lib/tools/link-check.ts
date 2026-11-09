// Broken link checker (/tools/broken-link-checker): pull every link and image off ONE public page, then check each
// target SSRF-safely. Pure pieces (extraction, classification, the scheduler) take an injectable fetcher so they can be
// unit-tested without the network. Every target is re-validated with assertPublicUrl on every hop — a public page can
// link to internal addresses, and redirects can point anywhere.
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import * as cheerio from "cheerio";
import ipaddr from "ipaddr.js";
import { assertPublicUrl, SafeFetchError, USER_AGENT } from "@/lib/crawler/safe-fetch";
import { isSameSite } from "@/lib/crawler/normalize";

export const LINK_CHECK_LIMITS = {
  /** Most unique targets we check on one page. */
  maxTargets: 150,
  /** Requests in flight at once, across all hosts. */
  concurrency: 8,
  /** Requests in flight at once to any single host (politeness). */
  perHost: 3,
  /** Per-request timeout. */
  timeoutMs: 6_000,
  /** Redirect hops we follow before giving up. */
  maxRedirects: 5,
  /** Largest page we read to find links. */
  pageMaxBytes: 2 * 1024 * 1024,
} as const;

export type LinkKind = "link" | "image";
export type LinkClass = "ok" | "redirect" | "broken" | "timeout" | "blocked" | "error";

export interface LinkTarget {
  url: string;
  /** Visible anchor text, image alt text or a short fallback. Untrusted. */
  text: string;
  kind: LinkKind;
  internal: boolean;
}

export interface LinkHop {
  url: string;
  status: number;
}

export interface LinkResult extends LinkTarget {
  class: LinkClass;
  /** Final HTTP status, or null when no response arrived. */
  status: number | null;
  /** Where the link finally lands (after redirects); null when no response arrived. */
  finalUrl: string | null;
  /** Redirect hops before the final URL (empty when there were none). */
  chain: LinkHop[];
  /** The link starts on http:// and ends on https:// — update it to the https address. */
  httpToHttps: boolean;
  /** Short plain-English detail for this link. */
  note: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------------------------------------------

export interface ExtractedTargets {
  targets: LinkTarget[];
  /** Unique http(s) targets found before the cap. */
  found: number;
  /** Links we skipped on purpose (mailto:, tel:, javascript:, #fragment, other schemes). */
  skipped: number;
  capped: boolean;
}

const SKIP_HREF = /^(mailto:|tel:|sms:|javascript:|data:|#)/i;
const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Absolute http(s) URL without the #fragment, or null. */
export function resolveTarget(raw: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  return u.toString();
}

/** Every <a href> and <img src> on the page: deduped, junk skipped, capped at `max`. */
export function extractLinkTargets(html: string, pageUrl: string, max: number = LINK_CHECK_LIMITS.maxTargets): ExtractedTargets {
  const $ = cheerio.load(html);
  let base = pageUrl;
  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) base = resolveTarget(baseHref, pageUrl) ?? pageUrl;
  const pageHost = new URL(pageUrl).hostname;

  const seen = new Map<string, LinkTarget>();
  let skipped = 0;
  const add = (raw: string, text: string, kind: LinkKind) => {
    const href = raw.trim();
    if (!href || SKIP_HREF.test(href)) {
      skipped++;
      return;
    }
    const url = resolveTarget(href, base);
    if (!url) {
      skipped++;
      return;
    }
    const prev = seen.get(url);
    if (prev) {
      if (!prev.text && text) prev.text = text;
      return;
    }
    seen.set(url, { url, text, kind, internal: isSameSite(url, [pageHost]) });
  };

  $("a[href], img[src]").each((_, el) => {
    const $el = $(el);
    if ((el as { tagName?: string }).tagName?.toLowerCase() === "img") {
      add($el.attr("src") ?? "", clean($el.attr("alt")).slice(0, 120) || "(image)", "image");
      return;
    }
    let text = clean($el.text());
    if (!text) {
      const alt = clean($el.find("img[alt]").first().attr("alt"));
      text = alt ? `[image: ${alt}]` : clean($el.attr("aria-label") ?? $el.attr("title"));
    }
    add($el.attr("href") ?? "", text.slice(0, 120), "link");
  });

  const all = [...seen.values()];
  return { targets: all.slice(0, max), found: all.length, skipped, capped: all.length > max };
}

// ---------------------------------------------------------------------------------------------------------------
// Classification (pure)
// ---------------------------------------------------------------------------------------------------------------

const REASONS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  410: "Gone",
  429: "Too Many Requests",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  999: "Request denied",
};

/** Statuses that usually mean "the site refused our checker", not "the page is gone". 999 is LinkedIn's bot block. */
export const BLOCKED_STATUSES = new Set([401, 403, 429, 999]);

/** Class of a final (non-redirect) HTTP status. */
export function classifyStatus(status: number): LinkClass {
  if (status >= 200 && status < 300) return "ok";
  if (BLOCKED_STATUSES.has(status)) return "blocked";
  return "broken";
}

export function statusLabel(status: number): string {
  return REASONS[status] ? `${status} ${REASONS[status]}` : String(status);
}

function protocolOf(u: string): string {
  try {
    return new URL(u).protocol;
  } catch {
    return "";
  }
}

/** Build a result from the final status and the redirect hops that led to it. */
export function classifyResponse(target: LinkTarget, status: number, finalUrl: string, chain: LinkHop[]): LinkResult {
  const httpToHttps = protocolOf(target.url) === "http:" && protocolOf(finalUrl) === "https:";
  const base = { ...target, status, finalUrl, chain, httpToHttps };
  const finalClass = classifyStatus(status);
  const hops = chain.length;
  const via = hops ? ` after ${hops} redirect${hops === 1 ? "" : "s"}` : "";

  if (finalClass === "blocked") {
    return { ...base, class: "blocked", note: `The site answered ${statusLabel(status)}${via}. It may still work for real visitors in a browser.` };
  }
  if (finalClass === "broken") {
    const what = status >= 500 ? "a server error" : status === 404 || status === 410 ? "page not found" : "an error";
    return { ...base, class: "broken", note: `The site answered ${statusLabel(status)} (${what})${via}.` };
  }
  if (hops === 0) return { ...base, class: "ok", note: `Works (${status}).` };

  const parts = [`Redirects ${hops} time${hops === 1 ? "" : "s"} to ${finalUrl}.`];
  if (hops >= 2) parts.push("That is a redirect chain: link straight to the final address.");
  if (httpToHttps) parts.push("The link uses http:// — switch it to https://.");
  if (chain.some((h) => h.status === 302 || h.status === 307)) parts.push("It uses a temporary redirect; a lasting move should be a 301.");
  return { ...base, class: "redirect", note: parts.join(" ") };
}

export type ProbeErrorCode = "timeout" | "dns" | "network" | "tls" | "blocked" | "invalid" | "too_many_redirects" | "budget";

export class LinkProbeError extends Error {
  constructor(public code: ProbeErrorCode, message: string) {
    super(message);
    this.name = "LinkProbeError";
  }
}

/** Build a result for a link that never produced a final response. */
export function classifyError(target: LinkTarget, err: LinkProbeError, chain: LinkHop[] = []): LinkResult {
  const base = { ...target, status: null, finalUrl: null, chain, httpToHttps: false };
  switch (err.code) {
    case "timeout":
      return { ...base, class: "timeout", note: `No answer within ${LINK_CHECK_LIMITS.timeoutMs / 1000} seconds. The site may be slow or down.` };
    case "dns":
      return { ...base, class: "error", note: "The domain name does not exist or has no address. The site may have closed." };
    case "tls":
      return { ...base, class: "error", note: "The site's security certificate is not valid, so browsers show a warning." };
    case "blocked":
      return { ...base, class: "error", note: "This points to a private or internal address. Visitors outside your network can't open it." };
    case "invalid":
      return { ...base, class: "error", note: "The link address is not valid." };
    case "too_many_redirects":
      return { ...base, class: "broken", note: `More than ${LINK_CHECK_LIMITS.maxRedirects} redirects — probably a redirect loop.` };
    default:
      return { ...base, class: "error", note: `We could not connect to the site${err.message ? ` (${err.message})` : ""}.` };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Checking (fetcher is injectable)
// ---------------------------------------------------------------------------------------------------------------

export interface ProbeResponse {
  status: number;
  /** Location header for 3xx answers. */
  location: string | null;
}

/** Send one request (no redirects followed, no body read). Throws LinkProbeError. */
export type ProbeFetcher = (url: string, method: "HEAD" | "GET", timeoutMs: number) => Promise<ProbeResponse>;

const isRedirect = (s: number) => s >= 300 && s < 400 && s !== 304;

/**
 * One hop: HEAD first, then GET when HEAD fails or is refused (many servers answer HEAD with 405/403/404/501
 * or drop the connection). Timeouts are not retried — the GET would only burn the same budget.
 */
export async function probeHop(url: string, fetcher: ProbeFetcher, timeoutMs: number): Promise<ProbeResponse> {
  try {
    const head = await fetcher(url, "HEAD", timeoutMs);
    if (head.status < 400) return head;
  } catch (e) {
    if (!(e instanceof LinkProbeError) || e.code !== "network") throw e;
  }
  return fetcher(url, "GET", timeoutMs);
}

/** Follow one target through its redirects and classify the outcome. Never throws. */
export async function checkTarget(
  target: LinkTarget,
  fetcher: ProbeFetcher,
  opts: { timeoutMs?: number; maxRedirects?: number; deadline?: number; now?: () => number } = {},
): Promise<LinkResult> {
  const timeoutMs = opts.timeoutMs ?? LINK_CHECK_LIMITS.timeoutMs;
  const maxRedirects = opts.maxRedirects ?? LINK_CHECK_LIMITS.maxRedirects;
  const now = opts.now ?? Date.now;
  const chain: LinkHop[] = [];
  let current = target.url;
  try {
    for (let hop = 0; ; hop++) {
      const left = opts.deadline === undefined ? timeoutMs : Math.min(timeoutMs, opts.deadline - now());
      if (left <= 0) throw new LinkProbeError("budget", "Out of time");
      let res: ProbeResponse;
      try {
        res = await probeHop(current, fetcher, left);
      } catch (e) {
        // A timeout cut short by the overall budget is "not checked", not "the site is slow".
        if (e instanceof LinkProbeError && e.code === "timeout" && left < timeoutMs) throw new LinkProbeError("budget", "Out of time");
        throw e;
      }
      if (isRedirect(res.status) && res.location) {
        if (hop >= maxRedirects) throw new LinkProbeError("too_many_redirects", "Too many redirects");
        let next: string;
        try {
          next = new URL(res.location, current).toString();
        } catch {
          throw new LinkProbeError("invalid", "Invalid redirect location");
        }
        chain.push({ url: current, status: res.status });
        current = next;
        continue;
      }
      return classifyResponse(target, res.status, current, chain);
    }
  } catch (e) {
    const err = e instanceof LinkProbeError ? e : new LinkProbeError("network", "");
    if (err.code === "budget") throw err;
    return classifyError(target, err, chain);
  }
}

export interface CheckLinksOptions {
  fetcher?: ProbeFetcher;
  concurrency?: number;
  perHost?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Epoch ms after which no new checks start and in-flight ones are cut short. */
  deadline?: number;
  now?: () => number;
}

export interface CheckLinksResult {
  /** Results in the same order as the input (targets we never got to are left out). */
  results: LinkResult[];
  /** Targets we never finished because the time budget ran out. */
  unchecked: number;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

/** Check targets with a global concurrency cap and a per-host cap, stopping at the deadline. */
export function checkLinks(targets: LinkTarget[], opts: CheckLinksOptions = {}): Promise<CheckLinksResult> {
  const fetcher = opts.fetcher ?? probeUrl;
  const concurrency = opts.concurrency ?? LINK_CHECK_LIMITS.concurrency;
  const perHost = opts.perHost ?? LINK_CHECK_LIMITS.perHost;
  const now = opts.now ?? Date.now;
  const out: (LinkResult | undefined)[] = new Array(targets.length);
  const queue = targets.map((t, i) => ({ t, i }));
  const inflight = new Map<string, number>();
  let active = 0;

  return new Promise((resolve) => {
    const finish = () => {
      const results = out.filter((r): r is LinkResult => r !== undefined);
      resolve({ results, unchecked: targets.length - results.length });
    };
    const pump = () => {
      const outOfTime = opts.deadline !== undefined && now() >= opts.deadline;
      if (!outOfTime) {
        for (let q = 0; q < queue.length && active < concurrency; ) {
          const host = hostOf(queue[q].t.url);
          if ((inflight.get(host) ?? 0) >= perHost) {
            q++;
            continue;
          }
          const { t, i } = queue.splice(q, 1)[0];
          active++;
          inflight.set(host, (inflight.get(host) ?? 0) + 1);
          checkTarget(t, fetcher, { timeoutMs: opts.timeoutMs, maxRedirects: opts.maxRedirects, deadline: opts.deadline, now })
            .then((r) => {
              out[i] = r;
            })
            .catch(() => {
              /* budget ran out: leave unchecked */
            })
            .finally(() => {
              active--;
              inflight.set(host, (inflight.get(host) ?? 1) - 1);
              pump();
            });
        }
      }
      if (active === 0) finish();
    };
    pump();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Real fetcher: SSRF-safe single request, headers only
// ---------------------------------------------------------------------------------------------------------------

const TLS_CODES = /CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i;

/**
 * One HEAD/GET to a public address: assertPublicUrl (scheme, port, DNS, private ranges), socket pinned to the
 * validated IP, our crawler user agent, and the connection dropped as soon as the status line and headers arrive.
 */
export async function probeUrl(url: string, method: "HEAD" | "GET", timeoutMs: number): Promise<ProbeResponse> {
  let target;
  try {
    target = await assertPublicUrl(url);
  } catch (e) {
    if (e instanceof SafeFetchError) {
      if (e.code === "dns_failed") throw new LinkProbeError("dns", e.message);
      if (e.code === "blocked") throw new LinkProbeError("blocked", e.message);
      throw new LinkProbeError("invalid", e.message);
    }
    throw new LinkProbeError("network", "");
  }
  const { address, family } = target;
  const u = target.url;
  u.hash = "";
  const isHttps = u.protocol === "https:";
  const hostname = u.hostname.startsWith("[") ? u.hostname.slice(1, -1) : u.hostname;
  const pinnedLookup = ((_h: string, o: { all?: boolean } | number | undefined, cb: unknown) => {
    const callback = (typeof o === "function" ? o : cb) as (...args: unknown[]) => void;
    if (typeof o === "object" && o !== null && o.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;

  return new Promise<ProbeResponse>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      fn();
    };
    const req = (isHttps ? https : http).request(
      {
        protocol: u.protocol,
        hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        lookup: pinnedLookup,
        agent: false,
        servername: isHttps && !ipaddr.isValid(hostname) ? hostname : undefined,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8",
          "accept-language": "en;q=0.9,*;q=0.5",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = isRedirect(status) ? (res.headers.location ?? null) : null;
        res.resume();
        done(() => resolve({ status, location }));
      },
    );
    const timer = setTimeout(() => done(() => reject(new LinkProbeError("timeout", "Timed out"))), Math.max(1, timeoutMs));
    req.on("error", (e: NodeJS.ErrnoException) => {
      const code = e.code ?? "";
      done(() => reject(new LinkProbeError(TLS_CODES.test(code) ? "tls" : "network", code)));
    });
    req.end();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Whole run
// ---------------------------------------------------------------------------------------------------------------

export interface LinkCheckReport {
  url: string;
  finalUrl: string;
  /** Unique http(s) links and images found on the page. */
  found: number;
  /** mailto:, tel:, javascript:, #fragment and other non-web links we skipped. */
  skipped: number;
  /** More than LINK_CHECK_LIMITS.maxTargets were found; only the first ones were checked. */
  capped: boolean;
  /** Targets we finished checking (= results.length). */
  checked: number;
  /** Targets we did not get to because the time budget ran out. */
  unchecked: number;
  counts: Record<LinkClass, number>;
  results: LinkResult[];
  durationMs: number;
}

export function countByClass(results: LinkResult[]): Record<LinkClass, number> {
  const counts: Record<LinkClass, number> = { ok: 0, redirect: 0, broken: 0, timeout: 0, blocked: 0, error: 0 };
  for (const r of results) counts[r.class]++;
  return counts;
}

/** Extract targets from an already-fetched page and check them before `deadline`. */
export async function runLinkCheck(
  page: { url: string; finalUrl: string; html: string },
  opts: CheckLinksOptions & { maxTargets?: number } = {},
): Promise<LinkCheckReport> {
  const now = opts.now ?? Date.now;
  const started = now();
  const ex = extractLinkTargets(page.html, page.finalUrl, opts.maxTargets ?? LINK_CHECK_LIMITS.maxTargets);
  const { results, unchecked } = await checkLinks(ex.targets, opts);
  return {
    url: page.url,
    finalUrl: page.finalUrl,
    found: ex.found,
    skipped: ex.skipped,
    capped: ex.capped,
    checked: results.length,
    unchecked,
    counts: countByClass(results),
    results,
    durationMs: now() - started,
  };
}
