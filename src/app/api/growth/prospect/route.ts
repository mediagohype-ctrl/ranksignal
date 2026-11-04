// POST /api/growth/prospect { url } — Agency plan: one-page prospect report for a client's website.
// Runs the free-check engine (website only, SSRF-safe, no LLM), rate-limited per organization, usage recorded.
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { recordUsage } from "@/lib/billing/usage";
import { getOrgAccess } from "@/lib/billing/access";
import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { FreeCheckError, runFreeCheck } from "@/lib/free-check/run";
import { checkProspectLimit, toProspectReport } from "@/lib/growth/prospect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({ url: z.string().max(2048) });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  const body = await parseBody(req, bodySchema);
  const org = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { planId: true } });
  if (org.planId !== "agency") {
    throw new HttpError(402, "plan_limit", "Prospect reports are part of the Agency plan. Upgrade to use them.");
  }
  if (!(await getOrgAccess(s.organizationId)).active) {
    throw new HttpError(402, "plan_inactive", "Your plan isn't active. Update your billing to make prospect reports.");
  }
  if (!normalizeInputUrl(body.url)) throw new HttpError(400, "invalid_url", "Enter a website address like example.com.");
  const limit = checkProspectLimit(s.organizationId);
  if (!limit.allowed) {
    throw new HttpError(
      429,
      "rate_limited",
      limit.scope === "minute" ? "That's a lot of reports at once. Wait a minute and try again." : "You've made today's prospect reports. Try again tomorrow.",
      { retryAfterSec: limit.retryAfterSec },
    );
  }
  const valid = await validateFreeCheckUrl(body.url);
  if (!valid.ok) throw new HttpError(400, valid.code, valid.message);

  try {
    const result = await runFreeCheck(valid.url);
    await recordUsage(s.organizationId, { provider: "crawler", taskType: "crawl_page", credits: Math.max(1, result.pagesChecked.length), costMicros: 0 }).catch(
      (e: unknown) => console.warn("[prospect] usage not recorded:", e instanceof Error ? e.message : e),
    );
    return json({ item: toProspectReport(result) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof FreeCheckError) throw new HttpError(e.code === "blocked_url" ? 400 : 422, e.code, e.message);
    throw e;
  }
});
