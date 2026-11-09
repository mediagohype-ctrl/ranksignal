// Shared helper for the free single-page tools (meta tags, headings, schema, ...): validate what the visitor typed,
// then fetch ONE public HTML page through the SSRF-safe fetcher with tight caps (2 MB, 10 s, 5 redirects).
// Every failure becomes an HttpError with a plain-English message the tool can show as-is.
import { HttpError } from "@/lib/api";
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { validateFreeCheckUrl } from "@/lib/free-check/validate";

export const PAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PAGE_TIMEOUT_MS = 10_000;
export const PAGE_MAX_REDIRECTS = 5;

export interface FetchedHtml {
  /** The normalised address we were asked to check. */
  url: string;
  /** Where we ended up after redirects. */
  finalUrl: string;
  status: number;
  /** Untrusted third-party HTML. */
  html: string;
  /** UTF-8 size of the decoded HTML. */
  bytes: number;
}

const HTML_TYPE = /^(text\/html|application\/xhtml\+xml)$/i;
const LOOKS_LIKE_HTML = /<(!doctype html|html|head|body|title|meta)\b/i;

function fetchErrorMessage(e: SafeFetchError): HttpError {
  switch (e.code) {
    case "timeout":
      return new HttpError(422, "fetch_timeout", "That page took longer than 10 seconds to load, so we stopped waiting. Try again, or check a lighter page.");
    case "too_large":
      return new HttpError(422, "page_too_large", "That page is bigger than 2 MB, which is more than this free tool reads. Try a smaller page.");
    case "too_many_redirects":
      return new HttpError(422, "too_many_redirects", "That address redirects too many times (more than 5). Check the final address and try that instead.");
    case "dns_failed":
      return new HttpError(400, "invalid_url", "We couldn't find that website. Check the address and try again.");
    case "invalid_url":
      return new HttpError(400, "invalid_url", "Enter a page address like example.com/about.");
    case "blocked":
      return new HttpError(400, "blocked_url", "That address isn't a public website we can check.");
    default:
      return new HttpError(422, "fetch_failed", "We couldn't connect to that website. It may be down or blocking visitors. Try again in a minute.");
  }
}

/**
 * Validate a visitor-typed address and fetch it as HTML, SSRF-safe. Throws HttpError with friendly messages:
 * 400 invalid_url / blocked_url, 422 fetch_timeout / page_too_large / too_many_redirects / fetch_failed /
 * http_error / not_html / empty_page.
 */
export async function fetchPublicHtml(input: string): Promise<FetchedHtml> {
  const valid = await validateFreeCheckUrl(input);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);

  let res: Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = await safeFetch(valid.url, { maxBytes: PAGE_MAX_BYTES, timeoutMs: PAGE_TIMEOUT_MS, maxRedirects: PAGE_MAX_REDIRECTS });
  } catch (e) {
    if (e instanceof SafeFetchError) throw fetchErrorMessage(e);
    throw e;
  }

  if (res.status >= 400 || res.status < 200) {
    const hint =
      res.status === 404 || res.status === 410
        ? "The page wasn't found. Check the address."
        : res.status === 401 || res.status === 403
          ? "The website refused our request. It may block automated visitors or need a login."
          : res.status >= 500
            ? "The website had a server problem. Try again later."
            : "Check the address and try again.";
    throw new HttpError(422, "http_error", `That page answered with error ${res.status}. ${hint}`, { status: res.status });
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const html = res.body;
  const isHtml = contentType ? HTML_TYPE.test(contentType) || (/^text\/plain$/i.test(contentType) && LOOKS_LIKE_HTML.test(html)) : LOOKS_LIKE_HTML.test(html);
  if (!isHtml) {
    throw new HttpError(422, "not_html", `That address is not a web page${contentType ? ` (it is ${contentType.slice(0, 60)})` : ""}. Enter the address of an HTML page.`);
  }
  if (!html.trim()) throw new HttpError(422, "empty_page", "That page came back empty, so there is nothing to check.");

  return { url: valid.url, finalUrl: res.finalUrl, status: res.status, html, bytes: Buffer.byteLength(html, "utf8") };
}
