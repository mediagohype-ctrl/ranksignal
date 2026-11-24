import { describe, expect, it } from "vitest";
import { AUTHORS, DEFAULT_AUTHOR, authorInitials, authorUrl } from "@/lib/authors";

describe("authors", () => {
  it("has a default author", () => {
    expect(DEFAULT_AUTHOR).toBeDefined();
    expect(DEFAULT_AUTHOR.slug).toBe("shubhankar-gupta");
    expect(DEFAULT_AUTHOR.name).toBe("Shubhankar Gupta");
  });

  it("builds author URLs", () => {
    expect(authorUrl("shubhankar-gupta")).toBe("/author/shubhankar-gupta");
    expect(authorUrl(DEFAULT_AUTHOR.slug)).toMatch(/^\/author\/[a-z0-9-]+$/);
  });

  it("every author has a matching slug, a role and a non-empty bio", () => {
    for (const [key, a] of Object.entries(AUTHORS)) {
      expect(a.slug).toBe(key);
      expect(a.role.trim()).not.toBe("");
      expect(a.bio.length).toBeGreaterThan(0);
      for (const line of a.bio) expect(line.trim()).not.toBe("");
      for (const url of a.sameAs) expect(url).toMatch(/^https:\/\//);
      expect(a.knowsAbout.length).toBeGreaterThan(0);
    }
  });

  it("makes initials for the avatar", () => {
    expect(authorInitials("Shubhankar Gupta")).toBe("SG");
  });
});
