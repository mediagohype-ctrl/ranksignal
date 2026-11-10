// Public API v1 HTTP layer: API-key auth, per-key and per-org rate limits, one JSON envelope, cheap ETags.
//   success  { "data": …, "meta"?: { "nextCursor": "…" | null, … } }
//   error    { "error": { "code": "…", "message": "…", "details"?: …, "requestId": "…" } }
// Rate limits are in-memory per process (src/lib/auth/rate-limit.ts); swap for Redis with multiple instances.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError, requestIdOf } from "@/lib/api";
import { checkRateLimit, clientIp, peekRateLimit } from "@/lib/auth/rate-limit";
import { apiKeyFromHeaders } from "@/lib/api-keys/keys";
import { apiLimitsFor } from "@/lib/api-keys/limits";
import { authenticateApiKey, type ApiPrincipal } from "@/lib/api-keys/service";
import { log } from "@/lib/log";

/** HttpError that carries extra response headers (rate-limit headers, WWW-Authenticate). */
export class ApiHttpError extends HttpError {
  constructor(status: number, code: string, message: string, public headers: Record<string, string> = {}, details?: unknown) {
    super(status, code, message, details);
  }
}

const MINUTE_MS = 60_000;
/** Failed key lookups per IP per minute before we stop checking (slows key guessing). */
export const BAD_KEY_LIMIT_PER_MINUTE = 20;

export interface RateState {
  limit: number;
  remaining: number;
  resetSec: number;
  dailyLimit: number;
  dailyRemaining: number;
}

export function rateHeaders(r: RateState): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(Math.max(0, r.remaining)),
    "X-RateLimit-Reset": String(r.resetSec),
    "X-RateLimit-Daily-Limit": String(r.dailyLimit),
    "X-RateLimit-Daily-Remaining": String(Math.max(0, r.dailyRemaining)),
  };
}

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);
const msToUtcMidnight = (now: number) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
};

/** Counts one request against the key's per-minute bucket and the organization's daily cap. Throws 429 when over. */
export function consumeRateLimit(p: ApiPrincipal, now = Date.now()): RateState {
  const limits = apiLimitsFor(p.planId);
  const minuteKey = `api:min:${p.keyId}`;
  const dayKey = `api:day:${p.organizationId}:${utcDay(now)}`;
  const minute = checkRateLimit(minuteKey, limits.perMinute, MINUTE_MS, now);
  const usedToday = peekRateLimit(dayKey, now);
  const base = {
    limit: limits.perMinute,
    remaining: limits.perMinute - peekRateLimit(minuteKey, now),
    resetSec: minute.retryAfterSec,
    dailyLimit: limits.perDay,
    dailyRemaining: limits.perDay - usedToday,
  };
  if (!minute.allowed) {
    throw new ApiHttpError(429, "rate_limited", `Too many requests: ${limits.perMinute} per minute per key. Try again in ${minute.retryAfterSec}s.`, {
      ...rateHeaders(base),
      "Retry-After": String(minute.retryAfterSec),
    });
  }
  const day = checkRateLimit(dayKey, limits.perDay, msToUtcMidnight(now), now);
  const state = { ...base, dailyRemaining: limits.perDay - peekRateLimit(dayKey, now) };
  if (!day.allowed) {
    throw new ApiHttpError(429, "daily_limit_reached", `Your plan allows ${limits.perDay} API requests a day. The limit resets at 00:00 UTC.`, {
      ...rateHeaders(state),
      "Retry-After": String(day.retryAfterSec),
    });
  }
  return state;
}

const UNAUTHORIZED_HEADERS = { "WWW-Authenticate": 'Bearer realm="mywebrank", error="invalid_token"' };

/** Authenticates `Authorization: Bearer mwr_…` and applies rate limits. Throws ApiHttpError (401/403/429). */
export async function authorizeApiRequest(req: Request, now = Date.now()): Promise<{ principal: ApiPrincipal; rate: RateState }> {
  const ip = clientIp(req);
  const badKeyBucket = `api:badkey:${ip}`;
  if (peekRateLimit(badKeyBucket, now) >= BAD_KEY_LIMIT_PER_MINUTE) {
    throw new ApiHttpError(429, "rate_limited", "Too many requests with an invalid API key. Try again in a minute.", { "Retry-After": "60" });
  }
  const presented = apiKeyFromHeaders(req.headers);
  if (!presented) {
    throw new ApiHttpError(401, "unauthorized", "Send your API key as: Authorization: Bearer mwr_…", { "WWW-Authenticate": 'Bearer realm="mywebrank"' });
  }
  const principal = await authenticateApiKey(presented, new Date(now));
  if (!principal) {
    checkRateLimit(badKeyBucket, BAD_KEY_LIMIT_PER_MINUTE, MINUTE_MS, now);
    throw new ApiHttpError(401, "invalid_api_key", "This API key is not valid or was revoked.", UNAUTHORIZED_HEADERS);
  }
  if (!principal.scopes.includes("read")) throw new ApiHttpError(403, "insufficient_scope", "This API key cannot read data.");
  return { principal, rate: consumeRateLimit(principal, now) };
}

export function apiErrorResponse(err: unknown, requestId: string, extraHeaders: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { "x-request-id": requestId, "Cache-Control": "no-store", ...extraHeaders };
  if (err instanceof ApiHttpError) Object.assign(headers, err.headers);
  if (err instanceof HttpError) {
    if (err.status >= 500) log.error("public_api.http_error", { requestId, code: err.code, err });
    const error = { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}), requestId };
    return NextResponse.json({ error }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "invalid_request", message: "Invalid query parameters", details: err.flatten(), requestId } }, { status: 400, headers });
  }
  log.error("public_api.unhandled", { requestId, err: err instanceof Error ? err : { class: typeof err, message: String(err) } });
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong", requestId } }, { status: 500, headers });
}

export function weakEtag(body: string): string {
  return `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
}

/** True when an If-None-Match header lists this ETag (or "*"). */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = (t: string) => t.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
}

export interface ApiResult {
  data: unknown;
  meta?: Record<string, unknown>;
}

export interface ApiContext {
  principal: ApiPrincipal;
  requestId: string;
  url: URL;
}

/**
 * Wraps a v1 route: auth + limits, then `{ data, meta }` with ETag / Cache-Control. Responses are private
 * (keyed by the Authorization header) and revalidated each time; a matching If-None-Match gets 304.
 */
export function apiRoute<P extends object = object>(fn: (req: Request, ctx: ApiContext, params: P) => Promise<ApiResult>) {
  // Next.js always passes the route context (params is a Promise, {} for routes without dynamic segments).
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const requestId = requestIdOf(req);
    let rate: RateState | null = null;
    try {
      const auth = await authorizeApiRequest(req);
      rate = auth.rate;
      const params = ((await routeCtx?.params) ?? {}) as P;
      const result = await fn(req, { principal: auth.principal, requestId, url: new URL(req.url) }, params);
      const body = JSON.stringify(result.meta ? { data: result.data, meta: result.meta } : { data: result.data });
      const etag = weakEtag(body);
      const headers: Record<string, string> = {
        ...rateHeaders(rate),
        "x-request-id": requestId,
        "Cache-Control": "private, no-cache",
        ETag: etag,
        Vary: "Authorization, X-API-Key",
      };
      if (etagMatches(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
      return new Response(body, { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
    } catch (err) {
      return apiErrorResponse(err, requestId, rate ? rateHeaders(rate) : {});
    }
  };
}
