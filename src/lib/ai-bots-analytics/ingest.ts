// Ingest endpoint support: per-project secret tokens (only a SHA-256 hash is stored, the token is shown once), a
// per-project rate limiter, batch validation, and the copy-paste Cloudflare Worker that forwards crawler hits.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { botUserAgentPattern } from "./bots";
import { hitFromObject, parseLogLine, type LogHit } from "./parse";
import { INGEST_LIMITS } from "./limits";

export const TOKEN_PREFIX = "mwr_bot_";

export function generateIngestToken(): { token: string; hash: string; prefix: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashIngestToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 4) };
}

export function hashIngestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Bearer token from the Authorization header (or x-mywebrank-token), shape-checked. */
export function readIngestToken(headers: Headers): string | null {
  const auth = headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth.trim());
  const t = m?.[1] ?? headers.get("x-mywebrank-token")?.trim() ?? "";
  return /^mwr_bot_[A-Za-z0-9_-]{20,64}$/.test(t) ? t : null;
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashIngestToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Sliding one-minute window per key (in memory, per instance). */
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
      const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (list.length >= limit) {
        hits.set(key, list);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000)) };
      }
      list.push(now);
      hits.set(key, list);
      if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}

const g = globalThis as unknown as { __aiBotIngestLimiter?: ReturnType<typeof createRateLimiter> };
export const ingestLimiter = (g.__aiBotIngestLimiter ??= createRateLimiter(INGEST_LIMITS.requestsPerMinute));

/**
 * Batch body → hits. Accepts { events: [{ ip, path, status, userAgent, time }] } (what the Worker sends), or
 * { lines: ["<combined or JSON log line>", ...] }. Returns null when the shape is wrong.
 */
export function parseIngestBatch(body: unknown, now = new Date()): { hits: LogHit[]; received: number } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as { events?: unknown; lines?: unknown };
  const list = Array.isArray(o.events) ? o.events : Array.isArray(o.lines) ? o.lines : null;
  if (!list || list.length > INGEST_LIMITS.maxEventsPerBatch) return null;
  const hits: LogHit[] = [];
  for (const item of list) {
    const hit = typeof item === "string" ? parseLogLine(item) : hitFromObject(item, now);
    if (hit) hits.push(hit);
  }
  return { hits, received: list.length };
}

/** Copy-paste Cloudflare Worker: passes every request through untouched and forwards crawler hits in the background. */
export function cloudflareWorkerSnippet(ingestUrl: string): string {
  return `// MyWebRank AI crawler logger for Cloudflare Workers.
// 1. Workers & Pages → Create → paste this → Deploy.
// 2. Settings → Variables → add a SECRET named MYWEBRANK_TOKEN with your ingest token.
// 3. Add a route for your site (e.g. example.com/*) so the Worker sees every request.
// Visitors are never slowed down: the page is served first and the log is sent afterwards.
const BOTS = /${botUserAgentPattern()}/i;
const INGEST_URL = "${ingestUrl}";

export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    const ua = request.headers.get("user-agent") || "";
    if (BOTS.test(ua) && env.MYWEBRANK_TOKEN) {
      const url = new URL(request.url);
      const event = {
        ip: request.headers.get("cf-connecting-ip"),
        path: url.pathname, // query strings are never sent
        status: response.status,
        userAgent: ua,
        time: new Date().toISOString(),
      };
      ctx.waitUntil(
        fetch(INGEST_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + env.MYWEBRANK_TOKEN },
          body: JSON.stringify({ events: [event] }),
        }).catch(() => {}),
      );
    }
    return response;
  },
};
`;
}
