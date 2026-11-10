import { describe, expect, it } from "vitest";
import {
  DEFAULT_SECTIONS, SECTION_IDS, builderLimitsFor, normalizeSections, readRange, resolveRange, templateCreateSchema, templateInputSchema, templatePatchSchema,
  visibleSections,
} from "@/lib/report-builder/sections";

describe("sections", () => {
  it("keeps the chosen order, drops unknown/duplicate ids and appends missing ones switched off", () => {
    const s = normalizeSections([{ id: "open_problems", enabled: true }, { id: "bogus" }, { id: "scores", enabled: false }, { id: "open_problems", enabled: false }]);
    expect(s.slice(0, 2)).toEqual([{ id: "open_problems", enabled: true }, { id: "scores", enabled: false }]);
    expect(s).toHaveLength(SECTION_IDS.length);
    expect(s.slice(2).every((x) => !x.enabled)).toBe(true);
    expect(new Set(s.map((x) => x.id)).size).toBe(SECTION_IDS.length);
  });
  it("falls back to the default layout for junk", () => {
    expect(normalizeSections("nope")).toEqual(DEFAULT_SECTIONS);
  });
});

describe("date ranges", () => {
  const now = new Date("2026-11-09T15:00:00Z");
  it("last month is the previous calendar month (UTC)", () => {
    const r = resolveRange({ preset: "last_month" }, now);
    expect(r.firstDay).toBe("2026-10-01");
    expect(r.lastDay).toBe("2026-10-31");
    expect(r.to.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(r.label).toContain("October");
  });
  it("rolling ranges end today", () => {
    expect(resolveRange({ preset: "last_30_days" }, now)).toMatchObject({ firstDay: "2026-10-11", lastDay: "2026-11-09" });
    expect(resolveRange({ preset: "this_month" }, now)).toMatchObject({ firstDay: "2026-11-01", lastDay: "2026-11-09" });
  });
  it("custom ranges are clamped to today and to a year", () => {
    expect(resolveRange({ preset: "custom", from: "2026-11-01", to: "2026-12-31" }, now).lastDay).toBe("2026-11-09");
    const long = resolveRange({ preset: "custom", from: "2020-01-01", to: "2026-11-01" }, now);
    expect((long.to.getTime() - long.from.getTime()) / 86_400_000).toBe(366);
  });
  it("bad stored ranges fall back to last month", () => {
    expect(readRange({ preset: "custom", from: "2026-02-30", to: "2026-03-01" })).toEqual({ preset: "last_month" });
    expect(readRange({ preset: "custom", from: "2026-03-05", to: "2026-03-01" })).toEqual({ preset: "last_month" });
    expect(readRange(null)).toEqual({ preset: "last_month" });
  });
});

describe("template input", () => {
  const ok = { name: " Monthly  report ", sections: DEFAULT_SECTIONS, intro: "Hi\u0007 there", notes: "", range: { preset: "last_month" } };
  it("cleans names and control characters", () => {
    const p = templateInputSchema.parse(ok);
    expect(p.name).toBe("Monthly report");
    expect(p.intro).toBe("Hi there");
  });
  it("rejects unknown sections, extra keys, bad custom dates and over-long notes", () => {
    expect(templateInputSchema.safeParse({ ...ok, sections: [{ id: "secret", enabled: true }] }).success).toBe(false);
    expect(templateInputSchema.safeParse({ ...ok, organizationId: "x" }).success).toBe(false);
    expect(templateInputSchema.safeParse({ ...ok, range: { preset: "custom", from: "2026-05-02", to: "2026-05-01" } }).success).toBe(false);
    expect(templateInputSchema.safeParse({ ...ok, notes: "x".repeat(9000) }).success).toBe(false);
    expect(templateInputSchema.safeParse({ ...ok, name: "   " }).success).toBe(false);
  });
  it("create accepts a scope; patch accepts partial bodies", () => {
    expect(templateCreateSchema.safeParse({ ...ok, scope: "org_default" }).success).toBe(true);
    expect(templateCreateSchema.safeParse({ ...ok, scope: "everyone" }).success).toBe(false);
    expect(templatePatchSchema.safeParse({ shareEnabled: true }).success).toBe(true);
  });
  it("has limits for every plan", () => {
    expect(builderLimitsFor("agency").orgDefault).toBe(true);
    expect(builderLimitsFor("trial").orgDefault).toBe(false);
    expect(builderLimitsFor("??")).toEqual(builderLimitsFor("trial"));
  });
});

describe("visible sections", () => {
  const data = { search: null, vitals: null };
  it("skips switched-off sections and optional ones without data", () => {
    const ids = visibleSections(
      [
        { id: "scores", enabled: true },
        { id: "search_console", enabled: true },
        { id: "core_web_vitals", enabled: true },
        { id: "agency_notes", enabled: true },
        { id: "open_problems", enabled: false },
      ],
      data,
      "  ",
    );
    expect(ids).toEqual(["scores"]);
    expect(visibleSections([{ id: "agency_notes", enabled: true }], data, "We fixed the menu.")).toEqual(["agency_notes"]);
  });
});
