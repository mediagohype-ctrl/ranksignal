// Google OAuth configuration (Search Console + GA4). Optional: when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are
// unset every Google endpoint answers 501 with setup help and the scheduler skips the sync.
import { HttpError } from "@/lib/api";

export const GOOGLE_PRODUCTS = ["gsc", "ga4"] as const;
export type GoogleProduct = (typeof GOOGLE_PRODUCTS)[number];

export const PRODUCT_LABEL: Record<GoogleProduct, string> = { gsc: "Google Search Console", ga4: "Google Analytics 4" };

/** Read-only scopes. Each product asks only for its own scope (least privilege) plus openid email. */
export const PRODUCT_SCOPES: Record<GoogleProduct, string[]> = {
  gsc: ["openid", "email", "https://www.googleapis.com/auth/webmasters.readonly"],
  ga4: ["openid", "email", "https://www.googleapis.com/auth/analytics.readonly"],
};

export const NOT_CONFIGURED_MESSAGE =
  "Google connections aren't set up on this server yet. The owner needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET " +
  "(from a Google Cloud OAuth client) and restart the app.";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function assertGoogleConfigured(): void {
  if (!isGoogleConfigured()) throw new HttpError(501, "google_not_configured", NOT_CONFIGURED_MESSAGE);
}

export function googleClient(): { clientId: string; clientSecret: string } {
  assertGoogleConfigured();
  return { clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim() };
}

export function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/integrations/google/callback`;
}

export function isGoogleProduct(v: unknown): v is GoogleProduct {
  return typeof v === "string" && (GOOGLE_PRODUCTS as readonly string[]).includes(v);
}
