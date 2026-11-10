// POST: check that {site}/{key}.txt is reachable and correct (SSRF-safe GET), and switch IndexNow on when it is. Admins.
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog, auditActorFromSession } from "@/lib/audit-log";
import { createRateLimiter } from "@/lib/ai-bots-analytics/ingest";
import { verifyIndexNowSite } from "@/lib/indexnow-customer/service";

type Ctx = { params: Promise<{ id: string }> };

const g = globalThis as unknown as { __indexNowVerifyLimiter?: ReturnType<typeof createRateLimiter> };
const limiter = (g.__indexNowVerifyLimiter ??= createRateLimiter(6));

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  const rl = limiter.take(project.id);
  if (!rl.ok) throw new HttpError(429, "rate_limited", `Please wait ${rl.retryAfterSec} seconds before checking again.`);
  const { site, result } = await verifyIndexNowSite(project);
  await writeAuditLog({
    organizationId: s.organizationId, ...auditActorFromSession(s), action: result.ok ? "indexnow.verified" : "indexnow.verify_failed",
    resourceType: "project", resourceId: project.id, after: { ok: result.ok, url: result.url },
  });
  return json({ item: { ok: result.ok, message: result.message, status: site.status, enabled: site.enabled } });
});
