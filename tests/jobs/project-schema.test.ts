import { describe, expect, it } from "vitest";
import {
  mergeSettingsPatch, patchNeedsAdmin, projectCreateSchema, projectPatchSchema, readNotificationPrefs, SettingsPatchError,
} from "@/lib/dashboard/project-schema";

const plan = { name: "Starter", maxPagesPerCrawl: 250, minScanIntervalDays: 7 };

describe("projectPatchSchema", () => {
  it("accepts schedule, notifications, competitors, brands, countries, languages", () => {
    const r = projectPatchSchema.parse({
      brandNames: [" Acme ", "Acme Co"],
      competitors: [{ name: "Rival", domain: "rival.com", aliases: ["Rivl"] }, { name: "Other", domain: "" }],
      countries: ["in", "US"],
      languages: ["EN", "hi"],
      settings: { schedule: { crawl: "monthly", visibility: "off" }, notifications: { email: false } },
    });
    expect(r.brandNames).toEqual(["Acme", "Acme Co"]);
    expect(r.competitors?.[1]).toEqual({ name: "Other", domain: undefined, aliases: [] });
    expect(r.countries).toEqual(["IN", "US"]);
    expect(r.languages).toEqual(["en", "hi"]);
    expect(r.settings?.schedule).toEqual({ crawl: "monthly", visibility: "off" });
  });

  it("rejects bad values", () => {
    for (const bad of [
      { settings: { schedule: { crawl: "daily" } } },
      { settings: { schedule: { crawl: "weekly", extra: "x" } } },
      { settings: { notifications: { email: "yes" } } },
      { brandNames: [] },
      { brandNames: ["Acme", "acme"] },
      { countries: ["IND"] },
      { languages: [] },
      { competitors: [{ name: "" }] },
      { competitors: [{ name: "X", domain: "not a domain" }] },
    ]) {
      expect(projectPatchSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("flags admin-only edits", () => {
    expect(patchNeedsAdmin(projectPatchSchema.parse({ settings: { schedule: { crawl: "off" } } }))).toBe(true);
    expect(patchNeedsAdmin(projectPatchSchema.parse({ settings: { automation: { allowClassB: [] } } }))).toBe(true);
    expect(patchNeedsAdmin(projectPatchSchema.parse({ name: "x", settings: { notifications: { email: true } } }))).toBe(false);
  });
});

describe("server-owned settings (share links)", () => {
  const stored = { share: { enabled: false, tokenId: "current" }, maxPagesPerCrawl: 100 };

  it("strips settings.share from PATCH and create bodies", () => {
    const patch = projectPatchSchema.parse({ settings: { share: { enabled: true, tokenId: "old-revoked" }, notifications: { email: true } } });
    expect(patch.settings).not.toHaveProperty("share");
    const create = projectCreateSchema.parse({
      name: "A", websiteUrl: "https://a.com", brandNames: ["A"], settings: { share: { enabled: true, tokenId: "x" } },
    });
    expect(create.settings).not.toHaveProperty("share");
  });

  it("a PATCH containing settings.share cannot change the stored share settings", () => {
    const body = projectPatchSchema.parse({ settings: { share: { enabled: true, tokenId: "old-revoked" }, schedule: { crawl: "monthly" } } });
    const { next } = mergeSettingsPatch(stored, body.settings!, plan);
    expect(next.share).toEqual({ enabled: false, tokenId: "current" });
    // Even if an unparsed object slipped through, the merge keeps the stored value.
    const raw = { share: { enabled: true, tokenId: "evil" } } as unknown as Parameters<typeof mergeSettingsPatch>[1];
    expect(mergeSettingsPatch(stored, raw, plan).next.share).toEqual({ enabled: false, tokenId: "current" });
    expect(mergeSettingsPatch({}, raw, plan).next).not.toHaveProperty("share");
  });
});

describe("mergeSettingsPatch", () => {
  it("merges known keys, clamps pages, reports changes", () => {
    const r = mergeSettingsPatch(
      { maxPagesPerCrawl: 50, automation: { allowClassB: ["update_title"] }, keyPages: ["/pricing"] },
      { maxPagesPerCrawl: 9999, automation: { allowClassB: ["update_title"] }, schedule: { visibility: "off" }, notifications: { email: false } },
      plan,
    );
    expect(r.next).toMatchObject({
      maxPagesPerCrawl: 250,
      keyPages: ["/pricing"],
      schedule: { crawl: "weekly", visibility: "off" },
      notifications: { email: false },
    });
    expect(r.automationChanged).toBe(false);
    expect(r.scheduleChanged).toBe(true);
    expect(readNotificationPrefs(r.next).email).toBe(false);
  });

  it("rejects schedules more frequent than the plan allows", () => {
    expect(() => mergeSettingsPatch({}, { schedule: { crawl: "weekly" } }, { ...plan, minScanIntervalDays: 14 })).toThrow(SettingsPatchError);
  });
});
