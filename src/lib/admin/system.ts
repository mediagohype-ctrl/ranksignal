// Environment / configuration health checklist for the admin System page.
// NEVER returns secret values — only "set" / "missing" (APP_URL is public and is shown).

export type CheckStatus = "ok" | "warn" | "missing" | "info";
export interface ConfigCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  group: "Core" | "AI providers" | "Email" | "Billing" | "Security" | "Jobs";
}

type Env = Record<string, string | undefined>;
const has = (env: Env, k: string) => !!env[k]?.trim();

function secret(env: Env, key: string, label: string, group: ConfigCheck["group"], required = false): ConfigCheck {
  const ok = has(env, key);
  return { key, label, group, status: ok ? "ok" : required ? "missing" : "warn", detail: ok ? "set" : required ? "missing (required)" : "not set (optional)" };
}

export function configChecklist(env: Env = process.env): ConfigCheck[] {
  const checks: ConfigCheck[] = [];
  const appUrl = env.APP_URL?.trim();
  let appUrlStatus: CheckStatus = "missing";
  let appUrlDetail = "not set — links in emails will point to localhost";
  if (appUrl) {
    let host = "";
    try {
      host = new URL(appUrl).hostname;
    } catch {
      host = "";
    }
    const local = !host || host === "localhost" || host === "127.0.0.1";
    appUrlStatus = local ? "warn" : appUrl.startsWith("https://") ? "ok" : "warn";
    appUrlDetail = `${appUrl}${local ? " (localhost)" : appUrl.startsWith("https://") ? "" : " (not https)"}`;
  }
  checks.push({ key: "APP_URL", label: "Public app URL", group: "Core", status: appUrlStatus, detail: appUrlDetail });
  checks.push(secret(env, "DATABASE_URL", "Database URL", "Core", true));
  checks.push(secret(env, "DIRECT_URL", "Direct DB URL (migrations)", "Core"));
  const ss = env.SESSION_SECRET ?? "";
  checks.push({
    key: "SESSION_SECRET",
    label: "Session secret",
    group: "Security",
    status: ss.length >= 32 ? "ok" : "missing",
    detail: ss.length >= 32 ? "set (≥ 32 chars)" : ss ? "too short (< 32 chars)" : "missing (required)",
  });
  const ck = env.CREDENTIALS_KEY ?? "";
  checks.push({
    key: "CREDENTIALS_KEY",
    label: "Connector credentials key",
    group: "Security",
    status: /^[0-9a-fA-F]{64}$/.test(ck) ? "ok" : ck ? "warn" : "missing",
    detail: /^[0-9a-fA-F]{64}$/.test(ck) ? "set (64 hex)" : ck ? "set but not 64 hex chars" : "missing — connectors cannot store credentials",
  });
  checks.push(secret(env, "TURNSTILE_SECRET_KEY", "Captcha (Turnstile) secret", "Security"));
  checks.push(secret(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "Captcha (Turnstile) site key", "Security"));

  checks.push(secret(env, "OPENROUTER_API_KEY", "OpenRouter API key", "AI providers"));
  checks.push(secret(env, "OPENAI_API_KEY", "OpenAI API key", "AI providers"));
  checks.push(secret(env, "GEMINI_API_KEY", "Gemini API key", "AI providers"));
  checks.push(secret(env, "PERPLEXITY_API_KEY", "Perplexity API key", "AI providers"));
  const dfs = has(env, "DATAFORSEO_LOGIN") && has(env, "DATAFORSEO_PASSWORD");
  checks.push({ key: "DATAFORSEO_*", label: "DataForSEO", group: "AI providers", status: dfs ? "ok" : "warn", detail: dfs ? "set" : "not set (optional)" });
  const anyAi = ["OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY"].some((k) => has(env, k)) || dfs;
  if (!anyAi) checks.push({ key: "AI", label: "Any AI provider", group: "AI providers", status: "missing", detail: "no AI provider configured — AI checks will not run" });
  checks.push({
    key: "AI_DAILY_BUDGET_USD",
    label: "Daily AI budget",
    group: "AI providers",
    status: "info",
    detail: has(env, "AI_DAILY_BUDGET_USD") ? `$${env.AI_DAILY_BUDGET_USD} / day` : "$5 / day (default)",
  });

  const resend = has(env, "RESEND_API_KEY") && has(env, "EMAIL_FROM");
  const smtp = has(env, "SMTP_HOST") && has(env, "SMTP_USER") && has(env, "SMTP_PASS");
  checks.push({
    key: "EMAIL",
    label: "Outgoing email",
    group: "Email",
    status: resend || smtp ? "ok" : "warn",
    detail: resend ? "Resend: set" : smtp ? "SMTP: set" : "not configured — emails are skipped and logged",
  });
  checks.push(secret(env, "EMAIL_FROM", "From address", "Email"));

  const rzp = has(env, "RAZORPAY_KEY_ID") && has(env, "RAZORPAY_KEY_SECRET");
  checks.push({ key: "RAZORPAY_KEY_*", label: "Razorpay API keys", group: "Billing", status: rzp ? "ok" : "warn", detail: rzp ? "set" : "not set — checkout disabled" });
  checks.push(secret(env, "RAZORPAY_WEBHOOK_SECRET", "Razorpay webhook secret", "Billing"));
  for (const p of ["STARTER", "GROWTH", "AGENCY"]) checks.push(secret(env, `RAZORPAY_PLAN_${p}`, `Razorpay plan id (${p.toLowerCase()})`, "Billing"));

  checks.push({
    key: "RUN_WORKER_IN_APP",
    label: "In-process job worker",
    group: "Jobs",
    status: "info",
    detail: env.RUN_WORKER_IN_APP === "false" ? "off (separate worker expected)" : "on",
  });
  checks.push({
    key: "SCHEDULER_DISABLED",
    label: "Scheduler",
    group: "Jobs",
    status: env.SCHEDULER_DISABLED === "true" ? "warn" : "ok",
    detail: env.SCHEDULER_DISABLED === "true" ? "disabled" : "enabled",
  });
  checks.push({
    key: "ALLOW_SIMULATED_PROVIDER",
    label: "Simulated provider",
    group: "Jobs",
    status: env.ALLOW_SIMULATED_PROVIDER === "true" ? "warn" : "info",
    detail: env.ALLOW_SIMULATED_PROVIDER === "true" ? "allowed (demo data possible)" : "not allowed",
  });
  return checks;
}
