import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { parseConfirmedFacts, wrongFacts, type AssessedClaim } from "@/lib/visibility/brand-knowledge";
import { summarizeVisibility } from "@/lib/report/visibility";

const claims: AssessedClaim[] = [
  { claim: "Acme Tiles is based in Mumbai.", fact: "city", verdict: "contradicts" },
  { claim: "Acme Tiles offers free home delivery.", fact: "sells", verdict: "not_supported" },
  { claim: "Acme Tiles sells furniture, not tiles.", fact: "sells", verdict: "contradicts" },
  { claim: "Its website is acme-tiles.com.", fact: "website", verdict: "contradicts" },
  { claim: "It serves only businesses.", fact: "customers", verdict: "contradicts" },
];

describe("wrong facts = contradictions of confirmed facts only", () => {
  it("keeps contradictions of confirmed facts and drops 'not supported' claims", () => {
    const confirmed = parseConfirmedFacts({ name: "Acme Tiles", sells: "Ceramic tiles", city: "Pune", country: "India" });
    expect(wrongFacts(claims, confirmed)).toEqual([
      "Acme Tiles is based in Mumbai.",
      "Acme Tiles sells furniture, not tiles.",
      "Its website is acme-tiles.com.",
    ]); // "customers" was never confirmed, so it can't be contradicted
  });

  it("with no confirmed facts, only name / website contradictions count", () => {
    expect(wrongFacts(claims, null)).toEqual(["Its website is acme-tiles.com."]);
    expect(wrongFacts(claims.filter((c) => c.fact !== "website"), parseConfirmedFacts({}))).toEqual([]);
  });

  it("parses Project.facts defensively", () => {
    expect(parseConfirmedFacts(null)).toBeNull();
    expect(parseConfirmedFacts(["x"])).toBeNull();
    expect(parseConfirmedFacts({ city: "  ", sells: 4 })).toBeNull();
    expect(parseConfirmedFacts({ city: " Pune ", extra: "x" })).toEqual({ city: "Pune" });
  });

  it("ignores inaccuracies stored by the older probe (it also listed unsupported claims)", () => {
    const old = summarizeVisibility(
      { metrics: { brandKnowledge: [{ provider: "openai", knowsBrand: true, summary: "s", inaccuracies: ["free delivery not supported"], version: "bk-1" }] }, finishedAt: null },
      [],
      ["Acme"],
    );
    expect(old.summary.brandKnowledge?.[0].inaccuracies).toEqual([]);
    const cur = summarizeVisibility(
      { metrics: { brandKnowledge: [{ provider: "openai", knowsBrand: true, summary: "s", inaccuracies: ["wrong city"], version: "bk-2" }] }, finishedAt: null },
      [],
      ["Acme"],
    );
    expect(cur.summary.brandKnowledge?.[0].inaccuracies).toEqual(["wrong city"]);
  });
});
