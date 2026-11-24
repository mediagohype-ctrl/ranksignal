import type { NextConfig } from "next";
import { PERMANENT_REDIRECTS } from "./src/lib/seo/redirects";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Pragmatic Content-Security-Policy. External origins actually used by the app:
 * - Google Fonts (stylesheet fonts.googleapis.com, files fonts.gstatic.com) — src/app/layout.tsx
 * - Cloudflare Turnstile (script + iframe challenges.cloudflare.com) — src/components/turnstile.tsx
 * - Razorpay Checkout (script checkout.razorpay.com; iframes api/checkout.razorpay.com; XHR api/lumberjack) —
 *   src/components/app/billing/razorpay-checkout.ts
 * - Google Analytics / Tag Manager and Microsoft Clarity — src/components/analytics.tsx
 * Images allow any https origin (white-label logos, avatars). Everything else is same-origin.
 * TODO(security): move to a nonce-based CSP (middleware-generated nonce + 'strict-dynamic') so 'unsafe-inline'
 * can be dropped from script-src. Next.js inline bootstrap scripts currently need it.
 */
const ANALYTICS_SCRIPTS = "https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms https://connect.facebook.net";
const ANALYTICS_CONNECT =
  "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com https://www.facebook.com https://connect.facebook.net";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://checkout.razorpay.com ${ANALYTICS_SCRIPTS}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com ${ANALYTICS_CONNECT}${isDev ? " ws: wss:" : ""}`,
  "frame-src https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

export const securityHeaders: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: csp },
];

// Pages that moved for good (308): the list lives in src/lib/seo/redirects.ts so blog links can skip the hop too.
export { PERMANENT_REDIRECTS };

const nextConfig: NextConfig = {
  // Lets a verification build run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Next 15 streams <title>, meta description, canonical, robots and hreflang into <body> for any user agent it
  // does not know as a bot. Crawlers outside its list (Screaming Frog, GPTBot, ClaudeBot, PerplexityBot, …) then
  // see them "outside <head>". Matching every UA makes all metadata render in <head> for everyone.
  htmlLimitedBots: /.*/,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return PERMANENT_REDIRECTS.map((r) => ({ ...r, permanent: true }));
  },
};

export default nextConfig;
