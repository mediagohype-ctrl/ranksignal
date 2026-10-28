import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, renderEmail } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { inviteTemplate } from "@/lib/email/templates";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("renderEmail", () => {
  it("escapes every user-supplied value", () => {
    const evil = `<script>alert("x")</script>&'`;
    const { html, text } = renderEmail({
      title: evil,
      preheader: evil,
      paragraphs: [evil, "plain"],
      cta: { label: evil, url: `https://example.com/?a=1&b="><img src=x>` },
      footer: evil,
    });
    expect(html).not.toContain("<script>");
    // The injected CTA url must not break out of its attribute (the layout's own logo <img> is fine).
    expect(html).not.toContain(`"><img src=x>`);
    expect(html).not.toMatch(/<img[^>]*src=x/);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
    expect(text).toContain(evil); // plain-text part is not HTML
  });

  it("neutralises non-http CTA links", () => {
    const { html, text } = renderEmail({ title: "t", paragraphs: [], cta: { label: "Go", url: "javascript:alert(1)" } });
    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
  });

  it("is table-based with a white card", () => {
    const { html } = renderEmail({ title: "Hello", paragraphs: ["Body"] });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("#ffffff");
  });

  it("escapeHtml covers the five HTML metacharacters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("invite template escapes organisation names", () => {
    const { html } = inviteTemplate({ inviterName: "<b>Eve</b>", organizationName: "<img src=x onerror=1>", role: "member", link: "https://app.test/x" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Eve</b>");
  });
});

describe("sendEmail", () => {
  it("skips (and never logs the body) when not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p>SECRET-BODY</p>", text: "SECRET-BODY" });
    expect(res).toEqual({ ok: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET-BODY");
  });

  it("posts to Resend with a bearer token when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "RankSignal <hello@example.com>");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>", text: "h", replyTo: "r@b.com" });
    expect(res).toEqual({ ok: true, id: "email_123" });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: "RankSignal <hello@example.com>", to: ["a@b.com"], subject: "s", reply_to: "r@b.com" });
  });

  it("returns ok:false without throwing on HTTP errors", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "x@example.com");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 422 })));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await sendEmail({ to: "a@b.com", subject: "s", html: "h", text: "h" })).toEqual({ ok: false });
  });
});
