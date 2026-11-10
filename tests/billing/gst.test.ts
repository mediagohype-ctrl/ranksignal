// GST maths (src/lib/billing/gst.ts): rate only when GSTIN is set, per-invoice rounding in paise, CGST+SGST vs IGST,
// unknown customer state → our state, display helpers, GSTIN checksum, amount in words, new Starter price.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatInr, gstConfig, gstFromTotal, gstSuffix, inrPlusGst, isValidGstin, planPriceWithGst, priceWithGst,
} from "@/lib/billing/gst";
import { amountInWords, numberToIndianWords } from "@/lib/billing/amount-words";
import { PLANS } from "@/lib/billing/plans";
import { isIndianStateCode, stateName } from "@/lib/billing/indian-states";

const OUR_GSTIN = "07AAACM1234A1ZA"; // valid checksum, Delhi

function registered(extra: Record<string, string> = {}) {
  vi.stubEnv("GSTIN", OUR_GSTIN);
  vi.stubEnv("GST_RATE_PERCENT", "");
  vi.stubEnv("GST_STATE_CODE", "");
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}
function unregistered() {
  vi.stubEnv("GSTIN", "");
  vi.stubEnv("GST_RATE_PERCENT", "");
  vi.stubEnv("GST_STATE_CODE", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("price", () => {
  it("Starter is ₹1,999 a month before GST; Growth and Agency unchanged", () => {
    expect(PLANS.starter.priceInrMonthly).toBe(1_999);
    expect(PLANS.growth.priceInrMonthly).toBe(7_999);
    expect(PLANS.agency.priceInrMonthly).toBe(19_999);
  });
});

describe("gstConfig", () => {
  it("is not registered without GSTIN: rate 0", () => {
    unregistered();
    const c = gstConfig();
    expect(c).toMatchObject({ registered: false, ratePercent: 0, gstin: null, stateCode: "07", sacCode: "998314", prefix: "MWR" });
  });

  it("defaults to 18% and takes the state code from the GSTIN", () => {
    registered();
    expect(gstConfig()).toMatchObject({ registered: true, ratePercent: 18, gstin: OUR_GSTIN, stateCode: "07" });
    vi.stubEnv("GSTIN", "27AAPFU0939F1ZV");
    expect(gstConfig().stateCode).toBe("27");
    vi.stubEnv("GST_STATE_CODE", "7");
    expect(gstConfig().stateCode).toBe("07");
  });

  it("honours GST_RATE_PERCENT and ignores nonsense", () => {
    registered({ GST_RATE_PERCENT: "12" });
    expect(gstConfig().ratePercent).toBe(12);
    vi.stubEnv("GST_RATE_PERCENT", "abc");
    expect(gstConfig().ratePercent).toBe(18);
    vi.stubEnv("GST_RATE_PERCENT", "-5");
    expect(gstConfig().ratePercent).toBe(18);
  });
});

describe("priceWithGst", () => {
  it("adds 18% on Starter: ₹1,999 + ₹359.82 = ₹2,358.82, CGST+SGST for our own state", () => {
    registered();
    const p = priceWithGst(199_900, { customerStateCode: "07" });
    expect(p).toEqual({
      basePaise: 199_900, gstPaise: 35_982, totalPaise: 235_882, ratePercent: 18, split: "cgst_sgst",
      cgstPaise: 17_991, sgstPaise: 17_991, igstPaise: 0,
    });
  });

  it("charges IGST to a customer in another state", () => {
    registered();
    const p = priceWithGst(799_900, { customerStateCode: "27" });
    expect(p).toMatchObject({ gstPaise: 143_982, totalPaise: 943_882, split: "igst", igstPaise: 143_982, cgstPaise: 0, sgstPaise: 0 });
  });

  it("treats an unknown customer state as our state (CGST+SGST)", () => {
    registered();
    expect(priceWithGst(100_000).split).toBe("cgst_sgst");
    expect(priceWithGst(100_000, { customerStateCode: null }).split).toBe("cgst_sgst");
    expect(priceWithGst(100_000, { customerStateCode: "xx" }).split).toBe("cgst_sgst");
  });

  it("rounds GST per invoice to the nearest paisa and splits an odd paisa", () => {
    registered();
    const p = priceWithGst(1_003); // 18% of 1003 = 180.54 → 181
    expect(p.gstPaise).toBe(181);
    expect(p.totalPaise).toBe(1_184);
    expect(p.cgstPaise + p.sgstPaise).toBe(181);
    expect([p.cgstPaise, p.sgstPaise]).toEqual([90, 91]);
  });

  it("adds nothing when we are not registered", () => {
    unregistered();
    expect(priceWithGst(199_900, { customerStateCode: "27" })).toEqual({
      basePaise: 199_900, gstPaise: 0, totalPaise: 199_900, ratePercent: 0, split: "none", cgstPaise: 0, sgstPaise: 0, igstPaise: 0,
    });
  });

  it("splits a GST-inclusive charge back into base + GST that add up exactly", () => {
    registered();
    expect(gstFromTotal(235_882)).toMatchObject({ basePaise: 199_900, gstPaise: 35_982, totalPaise: 235_882 });
    const odd = gstFromTotal(100_001, { customerStateCode: "29" });
    expect(odd.basePaise + odd.gstPaise).toBe(100_001);
    expect(odd.split).toBe("igst");
    unregistered();
    expect(gstFromTotal(199_900)).toMatchObject({ basePaise: 199_900, gstPaise: 0 });
  });

  it("gives every paid plan's price + GST (trial has none)", () => {
    registered();
    expect(planPriceWithGst("starter")?.totalPaise).toBe(235_882);
    expect(planPriceWithGst("growth")?.totalPaise).toBe(943_882);
    expect(planPriceWithGst("agency")?.totalPaise).toBe(2_359_882);
    expect(planPriceWithGst("trial")).toBeNull();
    expect(planPriceWithGst("nope")).toBeNull();
  });
});

describe("display", () => {
  it("formats rupees without decimals when whole, Indian grouping otherwise", () => {
    expect(formatInr(199_900)).toBe("₹1,999");
    expect(formatInr(235_882)).toBe("₹2,358.82");
    expect(formatInr(1_999_900)).toBe("₹19,999");
    expect(formatInr(12_345_678_905)).toBe("₹12,34,56,789.05");
    expect(formatInr(0)).toBe("₹0");
  });

  it("says + GST only when registered", () => {
    registered();
    expect(gstSuffix()).toBe(" + GST");
    expect(inrPlusGst(1_999)).toBe("₹1,999 + GST");
    unregistered();
    expect(gstSuffix()).toBe("");
    expect(inrPlusGst(1_999)).toBe("₹1,999");
  });
});

describe("GSTIN and states", () => {
  it("checks format and checksum", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin(" 27aapfu0939f1zv ")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZX")).toBe(false); // wrong check character
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isValidGstin("ABCDEFGHIJKLMNO")).toBe(false);
  });

  it("knows GST state codes", () => {
    expect(stateName("07")).toBe("Delhi");
    expect(stateName("27")).toBe("Maharashtra");
    expect(isIndianStateCode("38")).toBe(true);
    expect(isIndianStateCode("25")).toBe(false); // merged into 26
  });
});

describe("amount in words (Indian numbering)", () => {
  it("writes lakhs and crores", () => {
    expect(numberToIndianWords(2_358)).toBe("Two Thousand Three Hundred Fifty-Eight");
    expect(numberToIndianWords(1_20_000)).toBe("One Lakh Twenty Thousand");
    expect(numberToIndianWords(2_35_88_200)).toBe("Two Crore Thirty-Five Lakh Eighty-Eight Thousand Two Hundred");
    expect(amountInWords(235_882)).toBe("Rupees Two Thousand Three Hundred Fifty-Eight and Eighty-Two Paise Only");
    expect(amountInWords(199_900)).toBe("Rupees One Thousand Nine Hundred Ninety-Nine Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });
});
