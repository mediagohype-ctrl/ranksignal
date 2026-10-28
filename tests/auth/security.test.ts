import { afterEach, describe, expect, it, vi } from "vitest";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/security/turnstile";
import { isDisposableEmail, normalizeEmail, passwordPolicyError } from "@/lib/security/email-policy";
import { CAPTCHA_AFTER_FAILURES, clearLoginFailures, loginCaptchaRequired, recordLoginFailure } from "@/lib/auth/login-guard";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("turnstile", () => {
  it("is disabled and always passes when TURNSTILE_SECRET_KEY is unset", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(isTurnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(undefined)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires a token and checks siteverify when configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(isTurnstileEnabled()).toBe(true);
    expect(await verifyTurnstile(undefined)).toBe(false);
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });

  it("fails closed when siteverify says no or is unreachable", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    expect(await verifyTurnstile("tok")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await verifyTurnstile("tok")).toBe(false);
  });
});

describe("login captcha guard", () => {
  it("only requires captcha after repeated failures and when Turnstile is configured", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const ip = "9.9.9.9";
    const email = "guard@example.com";
    clearLoginFailures(ip, email);
    for (let i = 0; i < CAPTCHA_AFTER_FAILURES - 1; i++) recordLoginFailure(ip, email);
    expect(loginCaptchaRequired(ip, email)).toBe(false);
    recordLoginFailure(ip, email);
    expect(loginCaptchaRequired(ip, email)).toBe(true);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(loginCaptchaRequired(ip, email)).toBe(false);
    clearLoginFailures(ip, email);
  });
});

describe("signup email policy", () => {
  it("normalises emails", () => {
    expect(normalizeEmail("  Priya@Acme.COM ")).toBe("priya@acme.com");
  });

  it("blocks disposable domains (incl. subdomains) and honours env overrides", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@eu.mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@acme.com")).toBe(false);
    vi.stubEnv("DISPOSABLE_EMAIL_DOMAINS", "spammy.io, other.dev");
    expect(isDisposableEmail("x@spammy.io")).toBe(true);
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "mailinator.com");
    expect(isDisposableEmail("x@mailinator.com")).toBe(false);
  });

  it("rejects a password equal to the email", () => {
    expect(passwordPolicyError("Priya@Acme.com", "priya@acme.com")).toBeTruthy();
    expect(passwordPolicyError("priya@acme.com ", "priya@acme.com")).toBeTruthy();
    expect(passwordPolicyError("a long unrelated phrase", "priya@acme.com")).toBeNull();
  });
});
