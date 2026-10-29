import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Pragmatic Content-Security-Policy. External origins actually used by the app:
 * - Google Fonts (stylesheet fonts.googleapis.com, files fonts.gstatic.com) — src/app/layout.tsx
 * - Cloudflare Turnstile (script + iframe challenges.cloudflare.com) — src/components/turnstile.tsx
 * - Razorpay Checkout (script checkout.razorpay.com; iframes api/checkout.razorpay.com; XHR api/lumberjack) —
 *   src/components/app/billing/razorpay-checkout.ts
 * Images allow any https origin (white-label logos, avatars). Everything else is same-origin.
 * TODO(security): move to a nonce-based CSP (middleware-generated nonce + 'strict-dynamic') so 'unsafe-inline'
 * can be dropped from script-src. Next.js inline bootstrap scripts currently need it.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com${isDev ? " ws: wss:" : ""}`,
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

const nextConfig: NextConfig = {
  // Lets a verification build run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
