// Tracks failed sign-ins so we can (a) require a captcha after a few misses from one IP+email and
// (b) lock an email for a while after many misses from ANY IP (stops distributed password guessing).
import { checkRateLimit, peekRateLimit, resetRateLimit } from "./rate-limit";
import { isTurnstileEnabled } from "@/lib/security/turnstile";

export const CAPTCHA_AFTER_FAILURES = 3;
const WINDOW_MS = 15 * 60 * 1000;

/** Per-account lockout: this many failures within ACCOUNT_FAIL_WINDOW_MS lock the email for ACCOUNT_LOCK_MS. */
export const ACCOUNT_LOCK_AFTER_FAILURES = 10;
export const ACCOUNT_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

const failKey = (ip: string, email: string) => `login-fail:${ip}:${email}`;
const acctFailKey = (email: string) => `login-acct-fail:${email}`;
const acctLockKey = (email: string) => `login-lock:${email}`;

export function loginCaptchaRequired(ip: string, email: string): boolean {
  return isTurnstileEnabled() && peekRateLimit(failKey(ip, email)) >= CAPTCHA_AFTER_FAILURES;
}

/** True while the email is locked out (regardless of the IP asking). Applies to unknown emails too, so it reveals nothing. */
export function isAccountLocked(email: string, now = Date.now()): boolean {
  return peekRateLimit(acctLockKey(email), now) > 0;
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()) {
  checkRateLimit(failKey(ip, email), Number.MAX_SAFE_INTEGER, WINDOW_MS, now);
  checkRateLimit(acctFailKey(email), Number.MAX_SAFE_INTEGER, ACCOUNT_FAIL_WINDOW_MS, now);
  if (peekRateLimit(acctFailKey(email), now) >= ACCOUNT_LOCK_AFTER_FAILURES) {
    if (!isAccountLocked(email, now)) checkRateLimit(acctLockKey(email), Number.MAX_SAFE_INTEGER, ACCOUNT_LOCK_MS, now);
    // Start a fresh failure window once the lock is placed, so the lock does not immediately re-arm when it ends.
    resetRateLimit(acctFailKey(email));
  }
}

export function clearLoginFailures(ip: string, email: string) {
  resetRateLimit(failKey(ip, email));
  resetRateLimit(acctFailKey(email));
}
