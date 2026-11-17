// The free-check score shown in "Why this score is different from your free check" must be for THIS website.
import { describe, expect, it } from "vitest";
import { pickFreeCheckScore, siteKey } from "@/lib/dashboard/free-check-score";

describe("free-check score lookup", () => {
  it("matches the same host (www ignored) and takes the newest before the full check", () => {
    expect(siteKey("https://www.GoHype.in/about")).toBe("gohype.in");
    const leads = [
      { url: "https://gohype.in", score: 58, createdAt: new Date("2026-10-01") },
      { url: "gohype.in/", score: 61, createdAt: new Date("2026-10-20") },
      { url: "https://notgohype.in", score: 90, createdAt: new Date("2026-10-21") },
      { url: "https://gohype.in", score: 70, createdAt: new Date("2026-11-30") },
    ];
    expect(pickFreeCheckScore(leads, "https://www.gohype.in", new Date("2026-10-25"))).toBe(61);
    expect(pickFreeCheckScore(leads, "https://other.example", new Date("2026-10-25"))).toBeNull();
  });
});
