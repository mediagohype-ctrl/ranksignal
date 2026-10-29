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

/** Number of trusted reverse proxies in front of the app (Render adds one hop). TRUST_PROXY_HOPS, default 1. */
export function trustedProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw.trim() === "") return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 1;
}

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:.]+$/i;

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v || v.length > 64) return null;
  // "[::1]:1234" / "1.2.3.4:5678" -> strip ports.
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(v);
  if (bracket) v = bracket[1]!;
  else if (/^[\d.]+:\d+$/.test(v)) v = v.slice(0, v.lastIndexOf(":"));
  if (IPV4.test(v)) return v;
  if (v.includes(":") && IPV6.test(v)) return v.toLowerCase();
  return null;
}

/**
 * Client IP as seen by OUR proxy. X-Forwarded-For is client-controlled except for the entries our own proxies
 * append on the right, so we read the Nth entry from the RIGHT (N = TRUST_PROXY_HOPS). The leftmost value is
 * never trusted: an attacker could put any address there to dodge rate limits. Falls back to x-real-ip.
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const hops = trustedProxyHops();
  if (hops > 0) {
    const fwd = headers.get("x-forwarded-for");
    if (fwd) {
      const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length) {
        const ip = normalizeIp(parts[Math.max(0, parts.length - hops)]);
        if (ip) return ip;
      }
    }
  }
  return normalizeIp(headers.get("x-real-ip")) ?? "unknown";
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}
