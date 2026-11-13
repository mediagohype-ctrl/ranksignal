// POST /api/public/tools/faq-generator — 6–8 FAQ drafts grounded in one public page (SSRF-safe fetch) or pasted
// text. Captcha + 5/IP/hour, one paid LLM call per run on the cheap tools model, daily AI budget (503 when exhausted).
import { HttpError, handler, json, parseBody } from "@/lib/api";
import { setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";
import { normalizeInputUrl } from "@/lib/free-check/validate";
import { FAQ_MIN_SOURCE_CHARS, faqBodySchema, gateAiTool, generateFaqs, loadFaqSourceFromUrl } from "@/lib/tools/ai-writing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handler(withToolUsage("faq-generator", async (req: Request) => {
  const { turnstileToken, url, text, audience, location } = await parseBody(req, faqBodySchema);
  setToolUsage({ url: url || null, input: url ? null : text.slice(0, 200) });
  // Cheap checks first so a typo doesn't use up one of the visitor's runs.
  if (url) {
    if (!normalizeInputUrl(url)) throw new HttpError(400, "invalid_url", "Enter a page address like example.com/services.");
  } else if (text.length < FAQ_MIN_SOURCE_CHARS) {
    throw new HttpError(400, "missing_source", "Enter a page address, or paste your page text or topic (at least a sentence).");
  }

  await gateAiTool(req, "faq-generator", turnstileToken);
  const source = url ? await loadFaqSourceFromUrl(url) : { url: undefined, text };
  const faqs = await generateFaqs({ audience, location }, source.text, source.url);
  return json({ item: { faqs, sourceUrl: source.url ?? null } }, { headers: { "Cache-Control": "no-store" } });
}));
