// Rate limits for unauthenticated public endpoints (in-memory, single instance).
import { checkRateLimit } from "@/lib/auth/rate-limit";

const HOUR = 60 * 60 * 1000;

export const FREE_CHECK_LIMITS = { perIp: 3, global: 30, windowMs: HOUR } as const;
export const CONTACT_LIMITS = { perIp: 5, global: 60, windowMs: HOUR } as const;

export type LimitResult = { allowed: true } | { allowed: false; scope: "ip" | "global"; retryAfterSec: number };

function check(prefix: string, limits: { perIp: number; global: number; windowMs: number }, ip: string, now: number): LimitResult {
  // Per-IP first, so one noisy client cannot consume the global budget once it is itself blocked.
  const perIp = checkRateLimit(`${prefix}:ip:${ip}`, limits.perIp, limits.windowMs, now);
  if (!perIp.allowed) return { allowed: false, scope: "ip", retryAfterSec: perIp.retryAfterSec };
  const global = checkRateLimit(`${prefix}:global`, limits.global, limits.windowMs, now);
  if (!global.allowed) return { allowed: false, scope: "global", retryAfterSec: global.retryAfterSec };
  return { allowed: true };
}

/** 3 checks per IP per hour and 30 per hour across everyone (each check fetches up to ~8 URLs). */
export function checkFreeCheckLimit(ip: string, now = Date.now()): LimitResult {
  return check("free-check", FREE_CHECK_LIMITS, ip, now);
}

export function checkContactLimit(ip: string, now = Date.now()): LimitResult {
  return check("contact", CONTACT_LIMITS, ip, now);
}
