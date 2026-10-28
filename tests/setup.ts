// Runs before every test file. Blanks real credentials so no test can reach a paid AI provider, the mail
// server or the production database by accident. Keys are set to "" rather than deleted because Prisma
// loads .env on import and only fills variables that are still undefined. Tests that need a value stub it
// with vi.stubEnv.
const SECRET_KEYS = [
  "OPENROUTER_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY",
  "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY",
  "EMAIL_FROM", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
  "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
];
for (const key of SECRET_KEYS) process.env[key] = "";
// Unreachable database: an unmocked query fails fast instead of touching production.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
