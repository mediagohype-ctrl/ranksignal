import { describe, expect, it } from "vitest";
import { classifyAction, pageSignalsFor, POLICY_VERSION, detectRegulatedClaims } from "@/lib/policy/engine";
import { WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import { MANUAL_CAPABILITIES } from "@/lib/connectors/manual";

const page = { resourceType: "page", url: "https://acme.example/blog/widgets" };
const meta = { field: "meta_description", before: null, after: "Compare widget sizes, materials and delivery options from Acme." };

describe("policy engine", () => {
  it("is versioned", () => {
    expect(classifyAction({ type: "content_brief", target: null, proposedChange: null }).policyVersion).toBe(POLICY_VERSION);
    expect(POLICY_VERSION).toBe("2026-10-1");
  });

  it.each([
    ["A brief auto", { type: "content_brief" }, "A", "auto_execute"],
    ["A comparison brief auto", { type: "comparison_page_brief" }, "A", "auto_execute"],
    ["B not allow-listed", { type: "update_meta_description", connector: WORDPRESS_CAPABILITIES }, "B", "approval_required"],
    ["B allow-listed + rollback", { type: "update_meta_description", connector: WORDPRESS_CAPABILITIES, automation: { allowClassB: ["update_meta_description"] } }, "B", "auto_execute"],
    ["B allow-listed, no connector yet", { type: "update_meta_description", automation: { allowClassB: ["update_meta_description"] } }, "B", "approval_required"],
    ["B no rollback", { type: "update_meta_description", connector: { ...WORDPRESS_CAPABILITIES, rollback: false }, automation: { allowClassB: ["update_meta_description"] } }, "B", "blocked"],
    ["B lacks capability (manual)", { type: "update_meta_description", connector: MANUAL_CAPABILITIES }, "B", "blocked"],
    ["B explicitly no connector", { type: "update_title", connector: null }, "B", "blocked"],
    ["homepage metadata -> C", { type: "update_meta_description", page: { isHomepage: true }, automation: { allowClassB: ["update_meta_description"] }, connector: WORDPRESS_CAPABILITIES }, "C", "approval_required"],
    ["high traffic -> C", { type: "update_title", page: { isHighTraffic: true }, connector: WORDPRESS_CAPABILITIES }, "C", "approval_required"],
    ["FAQ schema C (no connector known)", { type: "add_faq_schema" }, "C", "approval_required"],
    ["FAQ schema, WP lacks updateSchema", { type: "add_faq_schema", connector: WORDPRESS_CAPABILITIES }, "C", "blocked"],
    ["product copy C", { type: "update_product_copy", connector: WORDPRESS_CAPABILITIES }, "C", "approval_required"],
    ["delete D", { type: "delete_page" }, "D", "blocked"],
    ["redirect D", { type: "create_redirect" }, "D", "blocked"],
    ["robots D", { type: "robots_review" }, "D", "blocked"],
    ["site-wide D", { type: "sitewide_change" }, "D", "blocked"],
    ["access control D", { type: "update_access_control" }, "D", "blocked"],
    ["unknown type fails closed", { type: "make_it_rank" }, "D", "blocked"],
  ] as const)("%s", (_l, partial, rc, decision) => {
    const r = classifyAction({ target: page, proposedChange: meta, ...(partial as object) } as Parameters<typeof classifyAction>[0]);
    expect(r.riskClass).toBe(rc);
    expect(r.decision).toBe(decision);
    expect(r.reason.length).toBeGreaterThan(10);
  });

  it("blocks checkout/payment targets even for allow-listed metadata", () => {
    const r = classifyAction({
      type: "update_meta_description", target: { resourceType: "page", url: "https://acme.example/checkout/" },
      proposedChange: meta, automation: { allowClassB: ["update_meta_description"] }, connector: WORDPRESS_CAPABILITIES,
    });
    expect(r).toMatchObject({ riskClass: "D", decision: "blocked" });
  });

  it("blocks slug/URL changes", () => {
    const r = classifyAction({ type: "update_title", target: page, proposedChange: { field: "slug", before: "a", after: "b" } });
    expect(r.decision).toBe("blocked");
  });

  it.each([
    "Our tea cures diabetes naturally.",
    "Guaranteed #1 ranking on Google.",
    "Clinically proven to reduce pain.",
    "Earn 12% returns every year, risk-free.",
  ])("regulated claim -> D blocked: %s", (after) => {
    const r = classifyAction({
      type: "update_meta_description", target: page, proposedChange: { field: "meta_description", before: null, after },
      automation: { allowClassB: ["update_meta_description"] }, connector: WORDPRESS_CAPABILITIES,
    });
    expect(r).toMatchObject({ riskClass: "D", decision: "blocked" });
    expect(detectRegulatedClaims(after).length).toBeGreaterThan(0);
  });

  it("derives page signals", () => {
    expect(pageSignalsFor("https://acme.example/", "https://acme.example", {}).isHomepage).toBe(true);
    expect(pageSignalsFor("https://www.acme.example/pricing/", "https://acme.example", { keyPages: ["https://acme.example/pricing"] }).isKeyLandingPage).toBe(true);
    expect(pageSignalsFor("https://acme.example/blog/x", "https://acme.example", {}).isHomepage).toBe(false);
  });
});
