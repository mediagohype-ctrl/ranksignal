import { describe, expect, it } from "vitest";
import { createManualConnector, MANUAL_CAPABILITIES } from "@/lib/connectors/manual";

describe("manual connector", () => {
  const c = createManualConnector({ type: "update_meta_description", target: { resourceType: "page", url: "https://acme.example/a" } });
  const change = { field: "meta_description", before: "old", after: "New description" };

  it("declares export-only capabilities", () => {
    const caps = c.getCapabilities();
    expect(caps.preview).toBe(true);
    for (const k of ["readPages", "createDraft", "updateContent", "updateMetadata", "updateSchema", "publish", "rollback", "delete"] as const) {
      expect(caps[k]).toBe(false);
    }
    expect(MANUAL_CAPABILITIES.limitations.length).toBeGreaterThan(0);
  });

  it("never reports success for writes and returns copy-ready instructions", async () => {
    const r = await c.applyPatch("x", change, undefined, "k");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("manual_required");
    expect(String(r.detail?.instructions)).toContain("New description");
    expect(String(r.detail?.instructions)).toContain("https://acme.example/a");
    expect((await c.createDraft("page", { title: "x" })).ok).toBe(false);
    expect((await c.rollback("x", { id: "x", type: "page", url: "", fields: {} })).ok).toBe(false);
    expect((await c.validateResource("x", change)).status).toBe("failed");
  });
});
