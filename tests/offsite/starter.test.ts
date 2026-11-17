import { describe, expect, it } from "vitest";
import { businessKind, starterListingsFor, STARTER_KEYS } from "@/lib/offsite/starter";
import { starterSuggestions } from "@/lib/offsite/suggestions";
import { STARTER_LISTINGS } from "@/lib/offsite/types";

const names = (k: Parameters<typeof starterListingsFor>[0]) => starterListingsFor(k).map((l) => l.name);

describe("businessKind", () => {
  it("reads the kind of business from what setup knows", () => {
    expect(businessKind({ sells: "Neck fans and bottles", platform: "shopify" })).toBe("online_store");
    expect(businessKind({ sells: "Steel bottles, kitchenware and gifts" })).toBe("online_store");
    expect(businessKind({ sells: "Digital marketing agency: SEO, ads and branding" })).toBe("agency");
    expect(businessKind({ sells: "Framer website design" })).toBe("agency");
    expect(businessKind({ sells: "CRM software for clinics" })).toBe("software");
    expect(businessKind({ sells: "Bakery with custom cakes", city: "Pune" })).toBe("local");
    expect(businessKind({ sells: "Industrial valves" })).toBe("default");
    expect(businessKind({})).toBe("default");
  });
});

describe("starter lists", () => {
  it("never offers software review sites to an agency or an online store", () => {
    for (const k of ["agency", "online_store", "local", "default"] as const) {
      expect(names(k)).not.toContain("G2");
      expect(names(k)).not.toContain("Capterra");
    }
  });

  it("matches the agreed lists", () => {
    expect(names("online_store")).toEqual([
      "Google Business Profile", "Amazon seller account", "Flipkart seller account", "Meesho supplier account", "Instagram shop", "Facebook Page", "YouTube channel",
    ]);
    expect(names("agency")).toEqual(["Google Business Profile", "Clutch", "GoodFirms", "DesignRush", "LinkedIn company page", "Justdial"]);
    expect(names("software")).toEqual(["G2", "Capterra", "Product Hunt", "LinkedIn company page"]);
    expect(names("local")).toEqual(["Google Business Profile", "Justdial", "Sulekha", "Facebook Page", "Instagram business profile"]);
    expect(names("default")).toEqual(["Google Business Profile", "LinkedIn company page", "Justdial", "IndiaMART", "Facebook Page"]);
  });

  it("every key exists in the catalogue", () => {
    const keys = new Set(STARTER_LISTINGS.map((l) => l.key));
    for (const list of Object.values(STARTER_KEYS)) for (const k of list) expect(keys.has(k), k).toBe(true);
  });

  it("starterSuggestions uses the kind's list and marks tracked ones", () => {
    const st = starterSuggestions([{ url: "https://clutch.co/profile/acme", name: "x" }], "agency");
    expect(st.map((s) => s.key)).toEqual(STARTER_KEYS.agency);
    expect(st.find((s) => s.key === "clutch")?.tracked).toBe(true);
  });
});
