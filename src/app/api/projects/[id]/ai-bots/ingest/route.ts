// Machine endpoint for a Cloudflare Worker / edge function: POST { events: [...] } or { lines: [...] } with
// "Authorization: Bearer <project ingest token>". No session/CSRF (middleware exempts this exact path); the token is
// the credential. Rate-limited per project, body capped, max 1,000 events per batch. Only aggregates are stored.
import { db } from "@/lib/db";
import { handler, HttpError, json } from "@/lib/api";
import { hashIngestToken, ingestLimiter, parseIngestBatch, readIngestToken } from "@/lib/ai-bots-analytics/ingest";
import { aiBotLimitsFor, INGEST_LIMITS } from "@/lib/ai-bots-analytics/limits";
import { ingestHits, planIdForOrg } from "@/lib/ai-bots-analytics/service";
import { getOrgAccess } from "@/lib/billing/access";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readCappedBody(req: Request, max: number): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, "too_large", `Batches are limited to ${max} bytes.`);
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new HttpError(413, "too_large", `Batches are limited to ${max} bytes.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const token = readIngestToken(req.headers);
  if (!token) throw new HttpError(401, "unauthorized", "Missing or malformed ingest token.");
  // Lookup by hash, then require the project id in the URL to match (a token only ever writes to its own project).
  const key = await db.aiBotIngestKey.findUnique({ where: { tokenHash: hashIngestToken(token) } });
  if (!key || key.projectId !== id) throw new HttpError(401, "unauthorized", "Invalid ingest token.");

  const limited = ingestLimiter.take(key.projectId);
  if (!limited.ok) {
    return json(
      { error: { code: "rate_limited", message: "Too many requests; slow down." } },
      { status: 429, headers: { "retry-after": String(limited.retryAfterSec) } },
    );
  }

  const access = await getOrgAccess(key.organizationId).catch(() => null);
  if (access && !access.active) throw new HttpError(402, "inactive", "This workspace's subscription isn't active.");
  const limits = aiBotLimitsFor(await planIdForOrg(key.organizationId));
  if (!limits.ingest) throw new HttpError(402, "plan_required", "Live crawler logging isn't included in this plan.");

  const text = await readCappedBody(req, INGEST_LIMITS.maxBodyBytes);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Body must be JSON: { events: [...] } or { lines: [...] }.");
  }
  const batch = parseIngestBatch(body);
  if (!batch) throw new HttpError(400, "invalid_batch", `Send { events: [...] } or { lines: [...] } with at most ${INGEST_LIMITS.maxEventsPerBatch} items.`);

  const { botHits } = await ingestHits({ organizationId: key.organizationId, projectId: key.projectId, hits: batch.hits, historyDays: limits.historyDays });
  // lastUsedAt at most once a minute (avoids a write per request).
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await db.aiBotIngestKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return json({ ok: true, received: batch.received, counted: botHits });
});
