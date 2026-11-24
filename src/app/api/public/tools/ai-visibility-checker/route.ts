// POST /api/public/tools/ai-visibility-checker — free AI visibility check: asks ChatGPT, Gemini and Perplexity one
// customer-style question and reports whether each names the business. Captcha + 3/IP/hour (30/hour overall),
// 24-hour cache per business + question, own daily spend cap, platform AI budget. Usage + AI cost are logged
// (admin "Free tool usage"). No login: the result shows before any email or sign-up.
import { HttpError, handler, json, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { addToolAiCost, setToolUsage, withToolUsage } from "@/lib/admin/tool-usage";
import { checkAiVisibilityLimit } from "@/lib/free-check/limits";
import { AI_CHECK_TOOL, AiCheckBusyError, aiCheckBodySchema, runAiVisibilityCheck } from "@/lib/tools/ai-visibility-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handler(withToolUsage(AI_CHECK_TOOL, async (req: Request) => {
  const { turnstileToken, ...input } = await parseBody(req, aiCheckBodySchema);
  setToolUsage({ input: `${input.business} · ${input.category}${input.city ? ` · ${input.city}` : ""}` });

  const ip = clientIp(req);
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "The security check failed. Please try again.");
  }
  const limit = checkAiVisibilityLimit(ip);
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used your free AI checks for this hour. Try again later, or start the free trial to track AI answers every week."
        : "Lots of people are checking right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }

  try {
    const item = await runAiVisibilityCheck(input, (micros, model) => addToolAiCost(micros, model));
    return json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AiCheckBusyError) {
      throw new HttpError(503, "ai_busy", "The AI check is busy right now. Please try again tomorrow, or run the free website check meanwhile.");
    }
    throw e;
  }
}));
