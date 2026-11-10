// Business Profile pure logic: Places response normalisation (caps, URL allow-lists), completeness checklist,
// NAP consistency vs website schema/contact page, due rule, search rate limit, plan refresh intervals.
import { describe, expect, it } from "vitest";
import { normalizePlace, readSnapshot, type RawPlace } from "@/lib/business-profile/places";
import { checklistScore, completenessChecklist } from "@/lib/business-profile/checklist";
import { compareNap, normalizeName, normalizePhone, postalCodesIn, siteNapFromPages } from "@/lib/business-profile/nap";
import { BUSINESS_PROFILE_REFRESH_DAYS, refreshDaysFor } from "@/lib/business-profile/limits";
import { allowSearch, isSnapshotDue } from "@/lib/business-profile/service";

const RAW: RawPlace = {
  id: "ChIJabcdefghijk",
  displayName: { text: "Sharma Dental Clinic" },
  formattedAddress: "12 MG Road, Kothrud, Pune, Maharashtra 411038, India",
  nationalPhoneNumber: "020 2545 1234",
  internationalPhoneNumber: "+91 20 2545 1234",
  websiteUri: "https://www.sharmadental.test/",
  googleMapsUri: "https://maps.google.com/?cid=123",
  rating: 4.6,
  userRatingCount: 87,
  businessStatus: "OPERATIONAL",
  primaryType: "dental_clinic",
  primaryTypeDisplayName: { text: "Dental clinic" },
  types: ["dental_clinic", "health"],
  regularOpeningHours: { weekdayDescriptions: ["Monday: 9:00 AM – 7:00 PM"] },
  photos: Array.from({ length: 10 }, () => ({})),
  reviews: Array.from({ length: 7 }, (_, i) => ({
    rating: 5,
    text: { text: `Great ${i}` },
    authorAttribution: { displayName: `User ${i}`, uri: i === 0 ? "javascript:alert(1)" : "https://www.google.com/maps/contrib/1" },
    relativePublishTimeDescription: "a week ago",
  })),
};

describe("normalizePlace", () => {
  it("keeps the fields we show and caps reviews at 5", () => {
    const s = normalizePlace(RAW, "ChIJabcdefghijk");
    expect(s).toMatchObject({ name: "Sharma Dental Clinic", rating: 4.6, reviewCount: 87, category: "Dental clinic", hasHours: true, photosCount: 10 });
    expect(s.reviews).toHaveLength(5);
    expect(s.reviews[0].authorUri).toBeNull(); // unsafe URL dropped
    expect(s.reviews[1].authorUri).toBe("https://www.google.com/maps/contrib/1");
    expect(readSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("rejects non-http websites and non-Google map links", () => {
    const s = normalizePlace({ ...RAW, websiteUri: "javascript:x", googleMapsUri: "https://evil.test/" }, "ChIJabcdefghijk");
    expect(s.website).toBeNull();
    expect(s.mapsUri).toBeNull();
  });
});

describe("checklist", () => {
  it("passes a complete listing (description is 'check' unless Google has a summary)", () => {
    const items = completenessChecklist(normalizePlace(RAW, "x"), { projectWebsite: "https://sharmadental.test" });
    expect(items.filter((i) => i.status !== "pass").map((i) => i.id)).toEqual(["description"]);
    expect(checklistScore(items)).toEqual({ passed: 8, total: 9 });
  });
  it("gives plain-English fixes for missing details", () => {
    const s = normalizePlace({ id: "ChIJabcdefghijk", displayName: { text: "X" }, businessStatus: "CLOSED_TEMPORARILY" }, "x");
    const items = completenessChecklist(s, { projectWebsite: "https://x.test" });
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    for (const id of ["status", "category", "hours", "website", "phone", "photos", "reviews"]) {
      expect(byId[id].status).toBe("fix");
      expect(byId[id].fix.length).toBeGreaterThan(20);
    }
  });
  it("flags a website link to another domain", () => {
    const items = completenessChecklist(normalizePlace(RAW, "x"), { projectWebsite: "https://newsite.test" });
    expect(items.find((i) => i.id === "website")?.status).toBe("check");
  });
});

describe("NAP", () => {
  it("normalises names, phones and PIN codes", () => {
    expect(normalizeName("Sharma Dental Clinic Pvt. Ltd.")).toBe("sharma dental clinic");
    expect(normalizePhone("+91 20 2545 1234")).toBe("2025451234");
    expect(normalizePhone("020-2545-1234")).toBe("2025451234");
    expect(postalCodesIn("Pune 411038, India")).toEqual(["411038"]);
  });

  const pages = [
    {
      url: "https://sharmadental.test/",
      extracted: {
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Dentist",
                name: "Sharma Dental Clinic Pvt Ltd",
                telephone: "+91-20-2545-1234",
                address: { "@type": "PostalAddress", streetAddress: "12 MG Road", addressLocality: "Pune", postalCode: "411038" },
                url: "https://sharmadental.test",
              },
            ],
          },
        ],
      },
    },
    { url: "https://sharmadental.test/contact", extracted: { textSample: "Call us on 98220 12345 or visit us." } },
  ];

  it("reads the website's NAP from schema and the contact page", () => {
    const site = siteNapFromPages(pages);
    expect(site.name).toBe("Sharma Dental Clinic Pvt Ltd");
    expect(site.phones).toEqual(expect.arrayContaining(["2025451234", "9822012345"]));
    expect(site.postalCodes).toEqual(["411038"]);
    expect(site.sources).toEqual(["https://sharmadental.test/", "https://sharmadental.test/contact"]);
  });

  it("matches a consistent listing and flags differences", () => {
    const place = normalizePlace(RAW, "x");
    const ok = compareNap(place, siteNapFromPages(pages), "https://sharmadental.test/");
    expect(ok.map((r) => r.status)).toEqual(["match", "match", "match", "match"]);
    const bad = compareNap(
      normalizePlace({ ...RAW, displayName: { text: "Smile Care" }, nationalPhoneNumber: "011 4000 0000", formattedAddress: "Delhi 110001", websiteUri: "https://other.test" }, "x"),
      siteNapFromPages(pages),
      "https://sharmadental.test/",
    );
    expect(bad.map((r) => r.status)).toEqual(["mismatch", "mismatch", "mismatch", "mismatch"]);
    expect(bad.every((r) => r.fix.length > 20)).toBe(true);
  });

  it("says when the website doesn't state its details", () => {
    const rows = compareNap(normalizePlace(RAW, "x"), siteNapFromPages([]), null);
    expect(rows.map((r) => r.status)).toEqual(["missing_site", "missing_site", "missing_site", "missing_site"]);
  });
});

describe("scheduling and limits", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  it("is due when never taken or older than the plan interval; failures back off", () => {
    expect(isSnapshotDue({ lastSnapshotAt: null, lastAttemptAt: null, lastError: null, refreshDays: 7, now })).toBe(true);
    expect(isSnapshotDue({ lastSnapshotAt: days(3), lastAttemptAt: days(3), lastError: null, refreshDays: 7, now })).toBe(false);
    expect(isSnapshotDue({ lastSnapshotAt: days(7), lastAttemptAt: days(7), lastError: null, refreshDays: 7, now })).toBe(true);
    expect(isSnapshotDue({ lastSnapshotAt: days(8), lastAttemptAt: new Date(now.getTime() - 3_600_000), lastError: "x", refreshDays: 7, now })).toBe(false);
  });
  it("has per-plan refresh intervals", () => {
    expect(BUSINESS_PROFILE_REFRESH_DAYS).toMatchObject({ starter: 7, growth: 7, agency: 3 });
    expect(refreshDaysFor("nope")).toBe(BUSINESS_PROFILE_REFRESH_DAYS.trial);
  });
  it("rate-limits searches per organization per hour", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allowSearch("org-rl", t + i, 3)).toBe(true);
    expect(allowSearch("org-rl", t + 10, 3)).toBe(false);
    expect(allowSearch("org-other", t + 10, 3)).toBe(true);
    expect(allowSearch("org-rl", t + 3_600_001, 3)).toBe(true);
  });
});
