// POST /api/public/tools/meta-description-generator — 5 AI meta description drafts. Captcha + 5/IP/hour (one paid
// LLM call per run on the cheap tools model), daily AI budget enforced by generateStructured (503 when exhausted).
import { handler, json, parseBody } from "@/lib/api";
import { setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";
import { descriptionBodySchema, gateAiTool, generateDescriptions } from "@/lib/tools/ai-writing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = handler(withToolUsage("meta-description-generator", async (req: Request) => {
  const { turnstileToken, ...input } = await parseBody(req, descriptionBodySchema);
  setToolUsage({ input: `${input.keyword} · ${input.topic}` });
  await gateAiTool(req, "meta-description-generator", turnstileToken);
  const descriptions = await generateDescriptions(input);
  return json({ item: { descriptions } }, { headers: { "Cache-Control": "no-store" } });
}));
