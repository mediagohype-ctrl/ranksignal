import { afterEach, describe, expect, it } from "vitest";
import { TOPUP_FROM_PAISE, TOPUP_PACKS, TOPUP_TEST_PACK, getTopUpPack, offeredTopUpPacks } from "@/lib/billing/topups";

describe("temporary ₹10 test pack", () => {
  afterEach(() => {
    delete process.env.TOPUP_TEST_PACK;
  });

  it("is hidden unless TOPUP_TEST_PACK is true", () => {
    expect(offeredTopUpPacks().map((p) => p.id)).not.toContain("answers_test");
    process.env.TOPUP_TEST_PACK = "false";
    expect(offeredTopUpPacks().map((p) => p.id)).not.toContain("answers_test");
  });

  it("is offered first while enabled, at ₹10 for 5 answers", () => {
    process.env.TOPUP_TEST_PACK = "true";
    const packs = offeredTopUpPacks();
    expect(packs[0]).toMatchObject({ id: "answers_test", answers: 5, pricePaise: 1000 });
    expect(packs).toHaveLength(TOPUP_PACKS.length + 1);
  });

  it("never changes the public 'from ₹250' price, and a paid test order can always be granted", () => {
    process.env.TOPUP_TEST_PACK = "true";
    expect(TOPUP_FROM_PAISE).toBe(25_000);
    expect(TOPUP_PACKS).not.toContain(TOPUP_TEST_PACK);
    delete process.env.TOPUP_TEST_PACK;
    expect(getTopUpPack("answers_test")?.answers).toBe(5);
  });
});
