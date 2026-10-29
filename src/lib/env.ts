// Environment validation (round 5 contract). validateEnv() is pure (pass an env object in tests);
// assertProductionEnv() throws in NODE_ENV=production when a fatal problem is found. Never logs values.

export interface EnvReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const isSet = (v: string | undefined) => typeof v === "string" && v.trim() !== "";

function parseUrl(v: string | undefined): URL | null {
  if (!isSet(v)) return null;
  try {
    return new URL(v!.trim());
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

/**
 * Checks configuration. In production the "errors" are fatal (see assertProductionEnv); outside production
 * the same problems are reported as warnings so local development keeps working.
 */
export function validateEnv(env: Env = process.env): EnvReport {
  const production = env.NODE_ENV === "production";
  const problems: string[] = [];
  const warnings: string[] = [];

  // ---- Fatal in production ----
  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 32) problems.push("SESSION_SECRET must be set and at least 32 characters long.");

  const appUrl = parseUrl(env.APP_URL);
  if (!appUrl) problems.push("APP_URL must be set to the public https URL of the app (e.g. https://app.example.com).");
  else if (LOCAL_HOSTS.has(appUrl.hostname) || appUrl.hostname.endsWith(".localhost")) problems.push("APP_URL must not point at localhost.");
  else if (appUrl.protocol !== "https:") problems.push("APP_URL must use https.");

  if (!/^[0-9a-fA-F]{64}$/.test((env.CREDENTIALS_KEY ?? "").trim())) {
    problems.push("CREDENTIALS_KEY must be 64 hex characters (32 bytes), e.g. from `openssl rand -hex 32`.");
  }

  if (!isSet(env.DATABASE_URL)) problems.push("DATABASE_URL must be set.");

  // ---- Warnings ----
  const db = parseUrl(env.DATABASE_URL);
  if (db && db.hostname.includes("-pooler") && db.searchParams.get("pgbouncer") !== "true") {
    warnings.push("DATABASE_URL uses a pooled (-pooler) host without pgbouncer=true; Prisma prepared statements can fail. Add ?pgbouncer=true.");
  }

  const smtp = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => isSet(env[k]));
  if (smtp.length > 0 && smtp.length < 3) {
    const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => !isSet(env[k]));
    warnings.push(`SMTP is partially configured (missing ${missing.join(", ")}); SMTP email will not be used.`);
  }
  if ((smtp.length === 3 || isSet(env.RESEND_API_KEY)) && !isSet(env.EMAIL_FROM)) {
    warnings.push("An email transport is configured but EMAIL_FROM is missing; no emails will be sent.");
  }

  const tsSecret = isSet(env.TURNSTILE_SECRET_KEY);
  const tsSite = isSet(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (tsSecret !== tsSite) {
    warnings.push(
      tsSecret
        ? "TURNSTILE_SECRET_KEY is set without NEXT_PUBLIC_TURNSTILE_SITE_KEY: the server will demand captcha tokens the page can't produce."
        : "NEXT_PUBLIC_TURNSTILE_SITE_KEY is set without TURNSTILE_SECRET_KEY: the captcha is shown but never verified.",
    );
  }

  if (production && env.ALLOW_SIMULATED_PROVIDER !== "false") {
    warnings.push('ALLOW_SIMULATED_PROVIDER is not "false" in production; simulated (clearly labelled) AI answers may be used when no provider is configured.');
  }

  const errors = production ? problems : [];
  if (!production) warnings.unshift(...problems.map((p) => `${p} (fatal in production)`));
  return { ok: errors.length === 0, errors, warnings };
}

/** Throws in production when the configuration is unsafe. Call once at boot (src/instrumentation.ts). */
export function assertProductionEnv(env: Env = process.env): EnvReport {
  const report = validateEnv(env);
  if (env.NODE_ENV === "production" && report.errors.length) {
    throw new Error(`Invalid production configuration:\n- ${report.errors.join("\n- ")}`);
  }
  for (const w of report.warnings) console.warn(`[env] ${w}`);
  return report;
}

/** Helper for the admin System page: env health without values. */
export function getEnvHealth(env: Env = process.env): EnvReport & { production: boolean } {
  return { ...validateEnv(env), production: env.NODE_ENV === "production" };
}
