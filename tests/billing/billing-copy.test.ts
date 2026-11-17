// Billing copy + small pure helpers added with the app audit (15 Nov 2026): checks-left lines in the top-up dialog,
// the Do it for me / Custom cards, invoice email, checkout prefill, settings ?tab= aliases.
import { describe, expect, it } from "vitest";
import { afterPackLine, answersCoverLine } from "@/components/app/billing/topup-dialog";
import { cleanPrefill } from "@/components/app/billing/razorpay-checkout";
import { billingOfferCards } from "@/lib/billing/offer-cards";
import { invoiceEmailTemplate, invoiceRecipients } from "@/lib/billing/invoice-email";
import { hasInvoiceBasics } from "@/lib/billing/billing-details";
import { UPGRADE_HREF } from "@/lib/billing/links";
import { CUSTOM_CONTACT_HREF, CUSTOM_PLAN, DFY_PLAN } from "@/components/marketing/plans";
import { tabFromQuery } from "@/app/app/settings/settings-tabs";

describe("top-up dialog: how many full checks the answers cover", () => {
  it("uses the plan's answers per check", () => {
    expect(answersCoverLine(225, 75)).toBe("You have 225 AI answers left: enough for 3 full AI checks (one full check uses 75 answers).");
    expect(answersCoverLine(75, 75)).toBe("You have 75 AI answers left: enough for 1 full AI check (one full check uses 75 answers).");
    expect(answersCoverLine(40, 75)).toBe("You have 40 AI answers left. That is not enough for a full AI check (one full check uses 75 answers).");
    expect(afterPackLine(40, 75, 75)).toBe("With this pack you'll have 115 answers: enough for 1 full AI check.");
    expect(afterPackLine(0, 300, 75)).toBe("With this pack you'll have 300 answers: enough for 4 full AI checks.");
  });
});

describe("Billing: Do it for me and Custom cards", () => {
  it("come from the pricing definitions; buttons book a call / open WhatsApp in a new tab", () => {
    const [dfy, custom] = billingOfferCards({ planId: "starter" }, { gst: true, bookHref: "https://cal.example/mywebrank" });
    expect(dfy).toMatchObject({ id: "dfy", name: DFY_PLAN.name, price: "₹19,999", priceSuffix: "+ GST / month", cta: "Book a free call", href: "https://cal.example/mywebrank", external: true, current: false });
    expect(dfy.name).toBe("Do it for me");
    expect(custom).toMatchObject({ id: "custom", name: CUSTOM_PLAN.name, cta: "Talk to us", href: CUSTOM_CONTACT_HREF, external: true });
    expect(custom.href).toMatch(/^https:\/\/wa\.me\/.+\?text=/);
  });
  it("without a calendar, Book a free call goes to the contact page (same tab)", () => {
    const [dfy] = billingOfferCards({ planId: "trial" }, { bookHref: "/contact?topic=services&tier=fix" });
    expect(dfy).toMatchObject({ href: "/contact?topic=services&tier=fix", external: false });
  });
  it("marks the workspace's own offer", () => {
    expect(billingOfferCards({ planId: "starter", serviceTier: "fix" }, { bookHref: "/x" }).map((c) => c.current)).toEqual([true, false]);
    expect(billingOfferCards({ planId: "agency" }, { bookHref: "/x" }).map((c) => c.current)).toEqual([false, true]);
  });
  it("every Upgrade button leads to the plan cards", () => {
    expect(UPGRADE_HREF).toBe("/app/settings?tab=billing#plans");
  });
});

describe("before the first payment", () => {
  it("needs a business name and a valid state", () => {
    expect(hasInvoiceBasics(null)).toBe(false);
    expect(hasInvoiceBasics({ legalName: "Sharma Traders", stateCode: "" })).toBe(false);
    expect(hasInvoiceBasics({ legalName: " ", stateCode: "27" })).toBe(false);
    expect(hasInvoiceBasics({ legalName: "Sharma Traders", stateCode: "99" })).toBe(false);
    expect(hasInvoiceBasics({ legalName: "Sharma Traders", stateCode: "27" })).toBe(true);
  });
  it("Razorpay prefill keeps only what we know", () => {
    expect(cleanPrefill({ email: " a@b.in ", name: "", contact: undefined })).toEqual({ email: "a@b.in" });
    expect(cleanPrefill({})).toBeUndefined();
    expect(cleanPrefill(null)).toBeUndefined();
  });
});

describe("invoice email", () => {
  const inv = {
    id: "inv_1",
    number: "MWR/2026-27/000007",
    description: "1 extra AI check (75 AI answers) (one-time top-up)",
    basePaise: 49_900,
    gstPaise: 8_982,
    totalPaise: 58_882,
    paidAt: new Date("2026-11-15T06:00:00Z"),
  };
  it("says the payment arrived and links to the invoice", () => {
    const e = invoiceEmailTemplate(inv);
    expect(e.subject).toBe("Payment received: ₹588.82 (invoice MWR/2026-27/000007)");
    expect(e.text).toContain("₹499 + ₹89.82 GST = ₹588.82");
    expect(e.text).toContain("/app/settings/invoices/inv_1");
    expect(e.html).toContain("Open your invoice");
  });
  it("goes to the invoice email and the owners, without duplicates", () => {
    expect(invoiceRecipients("Accounts@Sharma.in", ["owner@sharma.in", "accounts@sharma.in"])).toEqual(["accounts@sharma.in", "owner@sharma.in"]);
    expect(invoiceRecipients(null, [])).toEqual([]);
    expect(invoiceRecipients("not-an-email", ["o@x.in"])).toEqual(["o@x.in"]);
  });
});

describe("Settings ?tab= aliases", () => {
  it("?tab=team opens the Team tab (key: members)", () => {
    expect(tabFromQuery("team")).toBe("members");
    expect(tabFromQuery("members")).toBe("members");
    expect(tabFromQuery("billing")).toBe("billing");
    expect(tabFromQuery("plans")).toBe("billing");
    expect(tabFromQuery("nope")).toBeNull();
    expect(tabFromQuery(null)).toBeNull();
  });
});
