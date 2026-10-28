// Tracks failed sign-ins per IP+email so we can require a captcha after a few misses.
import { checkRateLimit, peekRateLimit, resetRateLimit } from "./rate-limit";
import { isTurnstileEnabled } from "@/lib/security/turnstile";

export const CAPTCHA_AFTER_FAILURES = 3;
const WINDOW_MS = 15 * 60 * 1000;

const failKey = (ip: string, email: string) => `login-fail:${ip}:${email}`;

export function loginCaptchaRequired(ip: string, email: string): boolean {
  return isTurnstileEnabled() && peekRateLimit(failKey(ip, email)) >= CAPTCHA_AFTER_FAILURES;
}

export function recordLoginFailure(ip: string, email: string) {
  checkRateLimit(failKey(ip, email), Number.MAX_SAFE_INTEGER, WINDOW_MS);
}

export function clearLoginFailures(ip: string, email: string) {
  resetRateLimit(failKey(ip, email));
}
