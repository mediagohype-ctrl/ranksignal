// POST /api/public/tools/llms-txt-checker — fetches a site's /llms.txt (SSRF-safe, 500 KB, 10 s, 5 redirects) and
// returns its text and HTTP result. The format checks run in the browser (src/lib/tools/llms-txt-check.ts), so pasted
// llms.txt text never needs the network. 20/IP/hour (400/hour overall), no DB writes.
import { z } from "zod";
import { handler, HttpError, json, parseBody } from "@/lib/api";
import { setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";
import { clientIp } from "@/lib/auth/rate-limit";
import { checkPageToolLimit } from "@/lib/free-check/limits";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { LLMS_INPUT_MAX_CHARS, looksLikeNonText, type LlmsFetchResult } from "@/lib/tools/llms-txt-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOOL = "llms-txt-checker";
const bodySchema = z.object({ url: z.string().max(2048) });

function fetchError(e: unknown): string {
  if (e instanceof SafeFetchError) {
    if (e.code === "timeout") return "Your llms.txt took longer than 10 seconds to load. Try again, or paste the file text instead.";
    if (e.code === "too_large") return "Your llms.txt is larger than 500 KB. Trim it to your most useful pages, then check again.";
    if (e.code === "too_many_redirects") return "Your llms.txt redirects more than 5 times. Make yoursite.com/llms.txt open the file directly.";
    if (e.code === "blocked") return "Your llms.txt redirects to an address that isn't a public website. Make it open on your own domain.";
  }
  return "We couldn't connect to your website. It may be down or blocking visitors. Paste the file text instead.";
}

export const POST = handler(withToolUsage("llms-txt-checker", async (req: Request) => {
  const body = await parseBody(req, bodySchema);
  setToolUsage({ url: body.url.trim() });
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");

  const limit = checkPageToolLimit(TOOL, clientIp(req));
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used this free tool 20 times this hour. Paste your llms.txt text instead, or try again later."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);
  const site = new URL(valid.url).origin;
  const llmsUrl = `${site}/llms.txt`;

  const result: LlmsFetchResult = { site, llmsUrl, finalUrl: null, status: null, contentType: null, text: null, error: null };
  try {
    const res = await safeFetch(llmsUrl, { maxBytes: LLMS_INPUT_MAX_CHARS, timeoutMs: 10_000, maxRedirects: 5 });
    result.finalUrl = res.finalUrl;
    result.status = res.status;
    result.contentType = res.headers.get("content-type");
    if (res.status >= 200 && res.status < 300) {
      // Many hosts answer every unknown address with their home page; that is not an llms.txt file.
      const kind = looksLikeNonText(res.body);
      const ct = (result.contentType ?? "").toLowerCase();
      const nonTextType = ct !== "" && !/^text\/|markdown|^application\/octet-stream/.test(ct);
      if (kind === "html" || /^text\/html/.test(ct)) {
        result.error = "Your website showed a web page at /llms.txt, not a text file, so there is no llms.txt yet. Use the Create llms.txt tab to make one.";
      } else if (kind === "binary" || nonTextType) {
        result.error = "The file at /llms.txt isn't plain text. Save it as a plain text file (UTF-8) and upload it again.";
      } else {
        result.text = res.body;
      }
    }
  } catch (e) {
    result.error = fetchError(e);
  }
  return json({ result }, { headers: { "Cache-Control": "no-store" } });
}));
