import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { metaConfigured, metaPayload, metaPixelId, metaUserData, metaVisitor } from "@/lib/meta/capi";
import { subscribeValue } from "@/lib/meta/subscribe";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

describe("Meta Conversions API", () => {
  it("uses MyWebRank's pixel by default and sends only once the token is set", () => {
    expect(metaPixelId({})).toBe("4537219149865300");
    expect(metaConfigured({})).toBe(false);
    expect(metaConfigured({ META_CAPI_TOKEN: "x" })).toBe(true);
    expect(metaConfigured({ META_PIXEL_ID: "off", META_CAPI_TOKEN: "x" })).toBe(false); // "off" switches Meta off
    // A blank or mistyped value (e.g. a copied placeholder) must not silently switch Meta off.
    expect(metaPixelId({ META_PIXEL_ID: "" })).toBe("4537219149865300");
    expect(metaPixelId({ META_PIXEL_ID: "YOUR_PIXEL_ID" })).toBe("4537219149865300");
    expect(metaPixelId({ META_PIXEL_ID: " 1234567890 " })).toBe("1234567890");
  });

  it("hashes email, phone and our ids; never sends them in plain text", () => {
    const u = metaUserData({ email: "  Owner@Shop.IN ", phone: "98765 43210", externalId: "org_1", ip: "1.2.3.4", userAgent: "UA", fbp: "fb.1.1.2", country: "IN" });
    expect(u.em).toEqual([sha("owner@shop.in")]);
    expect(u.ph).toEqual([sha("919876543210")]);
    expect(u.external_id).toEqual([sha("org_1")]);
    expect(u.country).toEqual([sha("in")]);
    expect(u).toMatchObject({ client_ip_address: "1.2.3.4", client_user_agent: "UA", fbp: "fb.1.1.2" });
    expect(JSON.stringify(u)).not.toContain("owner@shop.in");
  });

  it("builds one website event with a stable id, and adds the test code only when set", () => {
    const body = metaPayload({ name: "Lead", eventId: "lead-1", sourceUrl: "https://mywebrank.tech/free-check" }, 1_700_000_000_000, undefined);
    expect(body).toEqual({
      data: [
        {
          event_name: "Lead",
          event_time: 1_700_000_000,
          event_id: "lead-1",
          action_source: "website",
          user_data: {},
          event_source_url: "https://mywebrank.tech/free-check",
        },
      ],
    });
    expect(metaPayload({ name: "Lead" }, 0, "TEST123").test_event_code).toBe("TEST123");
  });

  it("reads the visitor's cookies and builds _fbc from an ad click (fbclid)", () => {
    const req = new Request("https://mywebrank.tech/api/public/free-check", {
      headers: { cookie: "a=1; _fbp=fb.1.111.222", referer: "https://mywebrank.tech/?fbclid=ABC", "user-agent": "UA" },
    });
    const v = metaVisitor(req);
    expect(v.user.fbp).toBe("fb.1.111.222");
    expect(v.user.fbc).toMatch(/^fb\.1\.\d+\.ABC$/);
    expect(v.sourceUrl).toBe("https://mywebrank.tech/?fbclid=ABC");
  });

  it("values a subscription at the monthly price, with GST when we are registered", () => {
    expect(subscribeValue("starter", {})).toBe(1_999);
    expect(subscribeValue("starter", { GSTIN: "07BWXPG9832Q2ZA", GST_RATE_PERCENT: "18" })).toBe(2_359);
  });
});
