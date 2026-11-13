import { describe, expect, it } from "vitest";
import { alertMode, parseUserAgent, shouldAlert, toolLabel, visitorInfo } from "@/lib/admin/tool-usage";
import { aiCostLabel, toolAlertEmail } from "@/lib/admin/tool-alert";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("tool usage: visitor details", () => {
  it("reads device and browser from the user agent", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ device: "Desktop (Windows)", browser: "Chrome" });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ device: "Mobile (iPhone/iPad)", browser: "Safari" });
    expect(parseUserAgent("curl/8.4").device).toBe("Bot / script");
    expect(parseUserAgent(null)).toEqual({ device: null, browser: null });
  });

  it("keeps only host + path of the referrer and the first language", () => {
    const req = new Request("https://mywebrank.tech/api/public/free-check", {
      headers: { "user-agent": CHROME_WIN, referer: "https://mywebrank.tech/free-check?utm=x#top", "accept-language": "en-IN,en;q=0.9", "cf-ipcountry": "IN" },
    });
    expect(visitorInfo(req)).toMatchObject({ referrer: "mywebrank.tech/free-check", language: "en-IN", country: "IN" });
  });
});

describe("tool usage: team alerts", () => {
  const ok = { tool: "meta-tag-checker", ok: true, device: "Desktop (Windows)" };
  it("alerts on every successful free check, and once per visitor per hour on other tools", () => {
    expect(shouldAlert({ ...ok, tool: "free-check" }, { mode: "all", recentSameVisitor: true })).toBe(true);
    expect(shouldAlert(ok, { mode: "all", recentSameVisitor: false })).toBe(true);
    expect(shouldAlert(ok, { mode: "all", recentSameVisitor: true })).toBe(false);
  });

  it("never alerts on failures, bots, or when switched off", () => {
    expect(shouldAlert({ ...ok, ok: false }, { mode: "all", recentSameVisitor: false })).toBe(false);
    expect(shouldAlert({ ...ok, device: "Bot / script" }, { mode: "all", recentSameVisitor: false })).toBe(false);
    expect(shouldAlert({ ...ok, tool: "free-check" }, { mode: "off", recentSameVisitor: false })).toBe(false);
    expect(shouldAlert(ok, { mode: "free_check", recentSameVisitor: false })).toBe(false);
    expect(alertMode(undefined)).toBe("all");
    expect(alertMode(" OFF ")).toBe("off");
  });

  it("writes an email with the website, visitor and AI cost", () => {
    const mail = toolAlertEmail({
      id: "t1", tool: "free-check", url: "https://example.com", input: null, score: 62, aiCostMicros: 0, aiModel: null,
      durationMs: 4200, userEmail: null, email: null, leadId: "lead1", device: "Mobile (Android)", browser: "Chrome",
      country: "IN", language: "hi-IN", referrer: "google.com/", createdAt: new Date("2026-11-13T06:30:00Z"),
    });
    expect(mail.subject).toBe("New Free website check: example.com · score 62");
    expect(mail.text).toContain("Website: https://example.com");
    expect(mail.text).toContain("Device: Mobile (Android) · Chrome");
    expect(mail.text).toContain("AI cost: ₹0 (no AI used)");
    expect(mail.text).toContain("/admin/leads/lead1");
    expect(aiCostLabel(4_400, 95)).toBe("₹0.42 ($0.0044)");
    expect(toolLabel("faq-generator")).toBe("FAQ generator (AI)");
  });

  it("flags a visitor who left their email as a hot lead", () => {
    const mail = toolAlertEmail(
      {
        id: "t1", tool: "free-check", url: "https://example.com", input: null, score: 62, aiCostMicros: 0, aiModel: null,
        durationMs: 0, userEmail: null, email: "owner@example.com", leadId: "lead1", device: null, browser: null,
        country: null, language: null, referrer: null, createdAt: new Date(),
      },
      { emailLeft: true },
    );
    expect(mail.subject).toBe("🔥 Hot lead: owner@example.com left their email (example.com)");
  });
});
