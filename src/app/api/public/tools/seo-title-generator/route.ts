// POST /api/public/tools/seo-title-generator — 5 AI title drafts for a page. Captcha + 5/IP/hour (one paid LLM call
// per run on the cheap tools model), daily AI budget enforced by generateStructured (503 when exhausted), no-store.
import { handler, json, parseBody } from "@/lib/api";
import { gateAiTool, generateTitles, titleBodySchema } from "@/lib/tools/ai-writing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handler(async (req: Request) => {
  const { turnstileToken, ...input } = await parseBody(req, titleBodySchema);
  await gateAiTool(req, "seo-title-generator", turnstileToken);
  const titles = await generateTitles(input);
  return json({ item: { titles } }, { headers: { "Cache-Control": "no-store" } });
});
