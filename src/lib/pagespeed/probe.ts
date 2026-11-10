// Post-crawl URL probes, all through the SSRF-safe clients (validated + pinned IPs, timeouts, byte caps):
//  - images: file size from a HEAD request (Content-Length), falling back to a 1-byte Range GET (Content-Range);
//  - link / canonical targets: a capped GET that follows redirects and records the hops and final status.
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { safeRequest } from "@/lib/net/safe-request";
import type { ProbeKind, ProbeResult } from "@/lib/pagespeed/types";
import type { ProbeTarget } from "@/lib/pagespeed/plan";

const PROBE_TIMEOUT_MS = 10_000;
/** Cap for the Range fallback: a server that ignores Range and sends more than this is "at least" this big. */
const RANGE_FALLBACK_MAX = 512 * 1024;

const errCode = (e: unknown) => (e instanceof SafeFetchError ? e.code : "network");

/** Total size from "bytes 0-0/12345". */
export function totalFromContentRange(v: string | null): number | null {
  const m = v ? /\/\s*(\d+)\s*$/.exec(v) : null;
  return m ? Number(m[1]) : null;
}

function lengthOf(h: Headers): number | null {
  const n = Number(h.get("content-length"));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function probeImage(t: ProbeTarget): Promise<ProbeResult> {
  const base = { kind: "image" as const, url: t.url, pages: t.pages, hops: 0 };
  try {
    const head = await safeRequest(t.url, { method: "HEAD", maxRedirects: 3, timeoutMs: PROBE_TIMEOUT_MS, headers: { accept: "image/*,*/*;q=0.5" } });
    const bytes = head.status >= 200 && head.status < 300 ? lengthOf(head.headers) : null;
    if (bytes !== null || (head.status >= 400 && head.status !== 405 && head.status !== 501 && head.status !== 403)) {
      return { ...base, status: head.status, finalUrl: head.url, bytes, contentType: head.headers.get("content-type"), error: null };
    }
  } catch {
    /* fall through to the Range request */
  }
  try {
    const res = await safeRequest(t.url, {
      method: "GET",
      maxRedirects: 3,
      timeoutMs: PROBE_TIMEOUT_MS,
      maxBytes: RANGE_FALLBACK_MAX,
      headers: { range: "bytes=0-0", accept: "image/*,*/*;q=0.5" },
    });
    const bytes = res.status === 206 ? totalFromContentRange(res.headers.get("content-range")) : res.status === 200 ? lengthOf(res.headers) : null;
    return { ...base, status: res.status, finalUrl: res.url, bytes, contentType: res.headers.get("content-type"), error: null };
  } catch (e) {
    if (errCode(e) === "too_large") {
      return { ...base, status: 200, finalUrl: t.url, bytes: RANGE_FALLBACK_MAX, bytesAtLeast: true, contentType: null, error: null };
    }
    return { ...base, status: null, finalUrl: null, bytes: null, contentType: null, error: errCode(e) };
  }
}

export async function probePage(t: ProbeTarget, kind: Exclude<ProbeKind, "image">): Promise<ProbeResult> {
  try {
    const res = await safeFetch(t.url, { timeoutMs: PROBE_TIMEOUT_MS, maxBytes: 3 * 1024 * 1024 });
    return {
      kind,
      url: t.url,
      pages: t.pages,
      status: res.status,
      finalUrl: res.finalUrl,
      hops: res.redirectChain.length,
      bytes: null,
      contentType: res.headers.get("content-type"),
      error: null,
    };
  } catch (e) {
    return { kind, url: t.url, pages: t.pages, status: null, finalUrl: null, hops: 0, bytes: null, contentType: null, error: errCode(e) };
  }
}
