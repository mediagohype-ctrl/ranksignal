import { describe, expect, it } from "vitest";
import { DfsError, parseEnvelope } from "@/lib/dataforseo/client";
import { locationFields, normaliseDomain, normaliseKeyword, countryCodeFor } from "@/lib/dataforseo/locations";
import { monthStart, monthlyAllowance, allowanceMessage } from "@/lib/dataforseo/usage";

describe("DataForSEO envelope", () => {
  it("returns the first task's results and the cost in micro-USD", () => {
    const r = parseEnvelope({ status_code: 20000, cost: 0.0035, tasks: [{ status_code: 20000, result: [{ items: [] }] }] });
    expect(r.result).toHaveLength(1);
    expect(r.costMicros).toBe(3500);
  });
  it("treats 'no results' as an empty answer, and other task errors as failures", () => {
    expect(parseEnvelope({ status_code: 20000, tasks: [{ status_code: 40102, result: null }] }).result).toEqual([]);
    expect(() => parseEnvelope({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field" }] })).toThrow(DfsError);
    try {
      parseEnvelope({ status_code: 50000 });
    } catch (e) {
      expect((e as DfsError).errorClass).toBe("transient");
    }
  });
});

describe("locations and input cleaning", () => {
  it("sends country codes for countries and names for Indian cities", () => {
    expect(locationFields("in")).toEqual({ location_code: 2356 });
    expect(locationFields("in-pune")).toEqual({ location_name: "Pune,Maharashtra,India" });
    expect(locationFields("nonsense")).toEqual({ location_code: 2356 });
    expect(countryCodeFor("in-mumbai")).toBe(2356);
  });
  it("normalises domains and rejects junk", () => {
    expect(normaliseDomain("https://www.Acme.co.in/about")).toBe("acme.co.in");
    expect(normaliseDomain("acme.in")).toBe("acme.in");
    expect(normaliseDomain("localhost")).toBeNull();
    expect(normaliseDomain("not a domain")).toBeNull();
  });
  it("normalises keywords", () => {
    expect(normaliseKeyword("  Plumber   in  PUNE ")).toBe("plumber in pune");
    expect(normaliseKeyword("")).toBeNull();
    expect(normaliseKeyword("x".repeat(81))).toBeNull();
  });
});

describe("monthly allowances", () => {
  it("falls back to trial limits for unknown plans and starts the month in UTC", () => {
    expect(monthlyAllowance("keyword_research", "growth")).toBe(200);
    expect(monthlyAllowance("keyword_research", "mystery")).toBe(monthlyAllowance("keyword_research", "trial"));
    expect(monthStart(new Date("2026-11-10T12:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("explains a used-up allowance in plain English", () => {
    expect(allowanceMessage({ feature: "backlinks", used: 10, limit: 10, remaining: 0, resetsAt: "2026-12-01T00:00:00.000Z" })).toMatch(/1 December/);
  });
});
