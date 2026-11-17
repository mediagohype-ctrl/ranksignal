// "Make small safe fixes without asking" is OFF unless the owner switched it on ("Nothing changes without your OK").
import { describe, expect, it } from "vitest";
import { classifyAction, CLASS_B_TYPES } from "@/lib/policy/engine";
import { isAutoFixOn, mergeSettingsPatch, projectSettingsSchema } from "@/lib/dashboard/project-schema";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";

const smallFix = (automation: { allowClassB?: string[] } | null | undefined) =>
  classifyAction({
    type: "update_meta_description",
    target: { resourceType: "page", url: "https://acme.example/blog/a" },
    proposedChange: { field: "meta_description", before: null, after: "A short summary about widgets." },
    automation,
    page: {},
    connector: WORDPRESS_CAPABILITIES,
  });

const plan = { name: "Do it myself", maxPagesPerCrawl: 100, minScanIntervalDays: 7 };

describe("auto-fix default", () => {
  it("unset or empty = off: a small fix waits for the owner's OK", () => {
    for (const automation of [undefined, null, {}, { allowClassB: [] }]) {
      expect(isAutoFixOn(automation === undefined ? {} : { automation })).toBe(false);
      expect(smallFix(automation).decision).toBe("approval_required");
    }
  });

  it("an owner who switched it on keeps it on", () => {
    const settings = { automation: { allowClassB: [...CLASS_B_TYPES] } };
    expect(isAutoFixOn(settings)).toBe(true);
    expect(smallFix(settings.automation).decision).toBe("auto_execute");
  });

  it("saving other settings never switches it on or off", () => {
    const off = mergeSettingsPatch({}, projectSettingsSchema.parse({ paused: false }), plan).next;
    expect(isAutoFixOn(off)).toBe(false);
    const on = mergeSettingsPatch({ automation: { allowClassB: ["update_title"] } }, projectSettingsSchema.parse({ paused: false }), plan).next;
    expect(isAutoFixOn(on)).toBe(true);
  });
});
