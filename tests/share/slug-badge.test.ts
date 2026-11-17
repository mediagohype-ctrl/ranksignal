// Short share links and the score badge's own switch (audit fixes 33 and 41).
import { describe, expect, it } from "vitest";
import {
  isBadgeActive, isShareSlug, isSlugActive, mergeBadgeSettings, mergeShareSettings, newShareSlug, preserveBadgeOnShareChange, readShareSettings,
  SLUG_RANDOM_LENGTH,
} from "@/lib/share/token";

describe("short share links", () => {
  it("are short, readable and carry ≥ 10 random characters", () => {
    const s = newShareSlug("https://www.go-hype.in/about");
    expect(s).toMatch(new RegExp(`^gohype-[a-z2-9]{${SLUG_RANDOM_LENGTH}}$`));
    expect(s.length).toBeLessThan(30);
    expect(isShareSlug(s)).toBe(true);
    expect(newShareSlug("https://www.go-hype.in")).not.toBe(s);
    expect(isShareSlug(newShareSlug(null))).toBe(true);
  });
  it("never match a signed token or junk", () => {
    expect(isShareSlug("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwIn0.sig")).toBe(false);
    expect(isShareSlug("gohype-52")).toBe(false);
    expect(isShareSlug("x".repeat(60))).toBe(false);
  });
  it("work only while sharing is on and only for the current slug", () => {
    const slug = newShareSlug("https://acme.example");
    expect(isSlugActive({ share: { enabled: true, tokenId: "t", slug } }, slug)).toBe(true);
    expect(isSlugActive({ share: { enabled: false, tokenId: "t", slug } }, slug)).toBe(false);
    expect(isSlugActive({ share: { enabled: true, tokenId: "t", slug: newShareSlug("https://acme.example") } }, slug)).toBe(false);
    expect(isSlugActive({ share: { enabled: true, tokenId: "t" } }, slug)).toBe(false);
  });
  it("are kept by the settings merge and other keys survive", () => {
    const slug = newShareSlug("https://acme.example");
    const merged = mergeShareSettings({ other: 1 }, { enabled: true, tokenId: "t", slug });
    expect(readShareSettings(merged)).toEqual({ enabled: true, tokenId: "t", slug });
    expect(merged.other).toBe(1);
  });
});

describe("score badge switch", () => {
  const claims = { projectId: "p", tokenId: "tok" };
  it("keeps a badge working after the share link is turned off", () => {
    const sharing = { share: { enabled: true, tokenId: "tok" } };
    expect(isBadgeActive(sharing, claims)).toBe(true); // legacy: badge rides on the share link
    const keep = preserveBadgeOnShareChange(sharing)!;
    expect(keep).toEqual({ enabled: true, tokenId: "tok" });
    const off = mergeShareSettings(mergeBadgeSettings(sharing, keep), { enabled: false, tokenId: "tok" });
    expect(isBadgeActive(off, claims)).toBe(true);
    // Replacing the share link doesn't touch the badge either.
    const rotated = mergeShareSettings(off, { enabled: true, tokenId: "new" });
    expect(isBadgeActive(rotated, claims)).toBe(true);
  });
  it("stops only when the owner turns the badge off", () => {
    expect(isBadgeActive({ badge: { enabled: false, tokenId: "tok" }, share: { enabled: true, tokenId: "tok" } }, claims)).toBe(false);
    expect(isBadgeActive({ badge: { enabled: true, tokenId: "other" } }, claims)).toBe(false);
    expect(preserveBadgeOnShareChange({ badge: { enabled: false, tokenId: "tok" }, share: { enabled: true, tokenId: "tok" } })).toBeNull();
    expect(preserveBadgeOnShareChange({ share: { enabled: false, tokenId: "tok" } })).toBeNull();
  });
});
