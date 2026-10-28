// Simple fixed-window in-memory rate limiter (per process). Swap for Redis in multi-instance deploys.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return { allowed: b.count <= limit, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

/** Current count in the active window without incrementing it (0 when no live window). */
export function peekRateLimit(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  return b && b.resetAt > now ? b.count : 0;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
