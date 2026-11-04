import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { claimScanText } from "@/lib/recommendations/job";
import { detectRegulatedClaims } from "@/lib/policy/engine";

const brief = [
  '# Content brief: "best tiles in Pune"',
  "## Rules",
  "- No promises about Google rankings, and no medical, legal or financial claims.",
  "- Results are measured after publishing; there's no promise AI assistants will use the page.",
  "",
  "## AI-suggested outline (review)",
  "1. What makes a tile last",
  "2. Prices in Pune",
  "",
  "> AI flagged unsupported claims to verify: guaranteed lowest price",
].join("\n");

describe("regulated-claim screen reads only generated content (bug 10)", () => {
  it("does not flag our own template or the AI's 'flagged claims' note", () => {
    const d = { proposedChange: { field: "brief", before: null, after: brief } };
    expect(detectRegulatedClaims(brief)).toContain("guaranteed"); // the old behaviour
    expect(detectRegulatedClaims(claimScanText(d, { generatedText: "1. What makes a tile last\n2. Prices in Pune" }))).toEqual([]);
    expect(claimScanText(d, null)).toBeNull(); // deterministic brief: nothing generated to screen
  });

  it("still flags claims the AI actually wrote", () => {
    const d = { proposedChange: { field: "brief", before: null, after: brief } };
    expect(detectRegulatedClaims(claimScanText(d, { generatedText: "1. Our guaranteed results" }))).toEqual(["guaranteed"]);
  });

  it("screens the proposed text of non-brief drafts", () => {
    const d = { proposedChange: { field: "meta_description", before: null, after: "Risk-free tiles, delivered." } };
    expect(claimScanText(d, null)).toBe("Risk-free tiles, delivered.");
    expect(detectRegulatedClaims(claimScanText(d, { generatedText: "Tiles that last, delivered in Pune." }))).toEqual([]);
  });
});
