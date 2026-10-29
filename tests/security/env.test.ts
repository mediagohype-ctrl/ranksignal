import { describe, expect, it } from "vitest";
import { assertProductionEnv, getEnvHealth, validateEnv } from "@/lib/env";

const GOOD = {
  NODE_ENV: "production",
  SESSION_SECRET: "x".repeat(40),
  APP_URL: "https://ranksignal.onrender.com",
  CREDENTIALS_KEY: "a".repeat(64),
  DATABASE_URL: "postgresql://u:p@ep-cool.neon.tech/db",
  ALLOW_SIMULATED_PROVIDER: "false",
};

describe("validateEnv", () => {
  it("passes a complete production config", () => {
    expect(validateEnv(GOOD)).toEqual({ ok: true, errors: [], warnings: [] });
    expect(() => assertProductionEnv(GOOD)).not.toThrow();
  });

  it.each([
    ["short SESSION_SECRET", { SESSION_SECRET: "short" }, /SESSION_SECRET/],
    ["missing APP_URL", { APP_URL: undefined }, /APP_URL must be set/],
    ["localhost APP_URL", { APP_URL: "https://localhost:3000" }, /localhost/],
    ["http APP_URL", { APP_URL: "http://app.example.com" }, /https/],
    ["bad CREDENTIALS_KEY", { CREDENTIALS_KEY: "abc" }, /CREDENTIALS_KEY/],
    ["non-hex CREDENTIALS_KEY", { CREDENTIALS_KEY: "z".repeat(64) }, /CREDENTIALS_KEY/],
    ["missing DATABASE_URL", { DATABASE_URL: "" }, /DATABASE_URL/],
  ])("%s is fatal in production", (_name, over, re) => {
    const env = { ...GOOD, ...over };
    const r = validateEnv(env);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(re);
    expect(() => assertProductionEnv(env)).toThrow(re);
  });

  it("outside production the same problems are only warnings", () => {
    const r = validateEnv({ NODE_ENV: "development" });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("SESSION_SECRET"))).toBe(true);
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
  });

  it("warns about pooler without pgbouncer, partial SMTP, lone Turnstile key, simulated provider", () => {
    const r = validateEnv({
      ...GOOD,
      DATABASE_URL: "postgresql://u:p@ep-cool-pooler.neon.tech/db?sslmode=require",
      SMTP_HOST: "smtp.example.com",
      TURNSTILE_SECRET_KEY: "s",
      ALLOW_SIMULATED_PROVIDER: undefined,
    });
    expect(r.ok).toBe(true);
    const all = r.warnings.join("\n");
    expect(all).toMatch(/pgbouncer=true/);
    expect(all).toMatch(/SMTP is partially configured/);
    expect(all).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    expect(all).toMatch(/ALLOW_SIMULATED_PROVIDER/);
    expect(validateEnv({ ...GOOD, DATABASE_URL: "postgresql://u:p@ep-cool-pooler.neon.tech/db?pgbouncer=true" }).warnings).toEqual([]);
  });

  it("never echoes secret values", () => {
    const r = validateEnv({ ...GOOD, SESSION_SECRET: "hunter2", CREDENTIALS_KEY: "deadbeef" });
    expect(JSON.stringify(r)).not.toMatch(/hunter2|deadbeef/);
    expect(getEnvHealth(GOOD)).toMatchObject({ ok: true, production: true });
  });
});
