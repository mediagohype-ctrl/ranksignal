import { describe, expect, it } from "vitest";
import nextConfig, { securityHeaders } from "../../next.config";

const get = (k: string) => securityHeaders.find((h) => h.key === k)?.value ?? "";

describe("security headers", () => {
  it("are applied to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: securityHeaders }]);
    expect(nextConfig.distDir).toBeTruthy();
  });

  it("set HSTS, nosniff, referrer, permissions and framing", () => {
    expect(get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(get("X-Frame-Options")).toBe("DENY");
  });

  it("CSP allows only the external origins the app uses", () => {
    const csp = Object.fromEntries(get("Content-Security-Policy").split("; ").map((d) => [d.split(" ")[0], d]));
    expect(csp["default-src"]).toBe("default-src 'self'");
    expect(csp["frame-ancestors"]).toBe("frame-ancestors 'none'");
    expect(csp["script-src"]).toContain("https://challenges.cloudflare.com");
    expect(csp["script-src"]).toContain("https://checkout.razorpay.com");
    expect(csp["style-src"]).toContain("https://fonts.googleapis.com");
    expect(csp["font-src"]).toContain("https://fonts.gstatic.com");
    expect(csp["connect-src"]).toContain("https://api.razorpay.com");
    expect(csp["connect-src"]).toContain("https://lumberjack.razorpay.com");
    expect(csp["frame-src"]).toBe("frame-src https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com");
    expect(csp["object-src"]).toBe("object-src 'none'");
  });
});
