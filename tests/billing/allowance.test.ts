import { describe, expect, it } from "vitest";
import { allocateOverflow, computeAiAllowance, needsSettlement, nextUtcMonthStart, outstandingAnswers, type TopUpPackState } from "@/lib/billing/allowance";

const NOW = new Date("2026-11-04T10:00:00Z");
const NO_EXTRA = { left: 0, expiresAt: null, packs: [] };

const pack = (id: string, o: Partial<TopUpPackState> = {}): TopUpPackState => ({
  id,
  answers: 100,
  consumed: 0,
  revokedAnswers: 0,
  purchasedAt: new Date("2026-10-01T00:00:00Z"),
  expiresAt: new Date("2027-10-01T00:00:00Z"),
  status: "paid",
  ...o,
});

describe("AI answers allowance math", () => {
  it("used = collected + answers still expected by checks in progress; used + left = cap", () => {
    const a = computeAiAllowance({ cap: 1_200, collected: 300, inFlight: [{ sampleSize: 200, collected: 50, failed: 10 }], trial: false, now: NOW });
    expect(a).toEqual({ used: 440, cap: 1_200, left: 760, monthlyLeft: 760, resetsAt: new Date("2026-12-01T00:00:00Z"), extra: NO_EXTRA });
    expect(a.used + a.left).toBe(a.cap);
  });
  it("never goes below 0 left, and shows used capped at the plan", () => {
    const a = computeAiAllowance({ cap: 300, collected: 290, inFlight: [{ sampleSize: 75, collected: 0, failed: 0 }], trial: false, now: NOW });
    expect(a).toMatchObject({ used: 300, left: 0 });
  });
  it("finished or over-collected runs hold nothing", () => {
    expect(outstandingAnswers({ sampleSize: 30, collected: 28, failed: 2 })).toBe(0);
    expect(outstandingAnswers({ sampleSize: 30, collected: 31, failed: 0 })).toBe(0);
    expect(outstandingAnswers({ sampleSize: 0, collected: 0, failed: 0 })).toBe(0);
  });
  it("trial answers don't reset (resetsAt null)", () => {
    const a = computeAiAllowance({ cap: 30, collected: 12, inFlight: [], trial: true, now: NOW });
    expect(a).toEqual({ used: 12, cap: 30, left: 18, monthlyLeft: 18, resetsAt: null, extra: NO_EXTRA });
  });
  it("resets at the start of the next UTC month (December rolls the year)", () => {
    expect(nextUtcMonthStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("extra AI answers (top-up packs)", () => {
  it("monthly answers are used first; extra answers untouched while the plan has answers left", () => {
    const a = computeAiAllowance({ cap: 1_200, collected: 380, inFlight: [], trial: false, now: NOW, packs: [pack("p1", { answers: 400 })] });
    expect(a).toMatchObject({ used: 380, cap: 1_200, monthlyLeft: 820, left: 1_220, extra: { left: 400 } });
  });
  it("after the plan runs out, extra answers are used — oldest pack first", () => {
    const older = pack("old", { purchasedAt: new Date("2026-09-01T00:00:00Z"), expiresAt: new Date("2027-09-01T00:00:00Z") });
    const newer = pack("new");
    const a = computeAiAllowance({ cap: 300, collected: 300 + 130, inFlight: [], trial: false, now: NOW, packs: [newer, older] });
    expect(a.monthlyLeft).toBe(0);
    expect(a.extra.packs).toEqual([
      { id: "old", left: 0, expiresAt: older.expiresAt },
      { id: "new", left: 70, expiresAt: newer.expiresAt },
    ]);
    expect(a.left).toBe(70);
    expect(a.extra.expiresAt).toEqual(newer.expiresAt); // earliest pack that still has answers
  });
  it("checks in progress hold extra answers too (no double promise)", () => {
    const a = computeAiAllowance({ cap: 300, collected: 290, inFlight: [{ sampleSize: 60, collected: 0, failed: 0 }], trial: false, now: NOW, packs: [pack("p")] });
    expect(a).toMatchObject({ monthlyLeft: 0, left: 50, extra: { left: 50 } });
  });
  it("answers settled in earlier months are not available again; never negative", () => {
    const a = computeAiAllowance({ cap: 300, collected: 400, inFlight: [], trial: false, now: NOW, packs: [pack("p", { consumed: 60 })] });
    expect(a.extra.left).toBe(0); // 40 left after last month, 100 used this month: overshoot is not negative
    expect(a.left).toBe(0);
  });
  it("expired, refunded and not-yet-bought packs give nothing", () => {
    const packs = [
      pack("expired", { purchasedAt: new Date("2025-10-01T00:00:00Z"), expiresAt: new Date("2026-10-01T00:00:00Z") }),
      pack("refunded", { status: "refunded", revokedAnswers: 100 }),
      pack("future", { purchasedAt: new Date("2026-12-01T00:00:00Z") }),
    ];
    const a = computeAiAllowance({ cap: 300, collected: 10, inFlight: [], trial: false, now: NOW, packs });
    expect(a.extra).toEqual(NO_EXTRA);
  });
  it("a pack that expired earlier this month only absorbs answers collected before its expiry", () => {
    const expiring = pack("exp", { purchasedAt: new Date("2025-11-02T00:00:00Z"), expiresAt: new Date("2026-11-02T00:00:00Z") });
    const live = pack("live");
    // 50 overflow answers in total this month; only 10 of them came before "exp" expired.
    const a = computeAiAllowance({ cap: 300, collected: 350, inFlight: [], trial: false, now: NOW, packs: [expiring, live], overflowBefore: { exp: 10 } });
    expect(a.extra.packs).toEqual([{ id: "live", left: 60, expiresAt: live.expiresAt }]);
  });
  it("trial: trial answers first, then extra; earlier months' settled use is not counted twice", () => {
    const p = pack("t", { consumed: 20 }); // 20 used from the pack in October (trial started in October)
    const a = computeAiAllowance({ cap: 30, collected: 30 + 20 + 15, inFlight: [], trial: true, now: NOW, packs: [p] });
    expect(a).toMatchObject({ used: 30, monthlyLeft: 0, resetsAt: null, extra: { left: 65 }, left: 65 });
  });
});

describe("allocateOverflow + settlement markers", () => {
  it("allocates FIFO, caps each pack at what it has left, reports the rest as unallocated", () => {
    const r = allocateOverflow([pack("b", { expiresAt: new Date("2027-12-01") }), pack("a", { answers: 30 })], 150, {
      windowStart: new Date("2026-10-01T00:00:00Z"),
      until: new Date("2026-11-01T00:00:00Z"),
    });
    expect(r).toEqual({ byPack: { a: 30, b: 100 }, allocated: 130, unallocated: 20 });
  });
  it("a pack needs settlement only for closed months while it was valid", () => {
    const month = new Date("2026-11-01T00:00:00Z");
    expect(needsSettlement({ settledThrough: new Date("2026-10-01T00:00:00Z"), expiresAt: new Date("2027-10-01") }, month)).toBe(true);
    expect(needsSettlement({ settledThrough: month, expiresAt: new Date("2027-10-01") }, month)).toBe(false);
    expect(needsSettlement({ settledThrough: new Date("2026-10-01T00:00:00Z"), expiresAt: new Date("2026-09-01") }, month)).toBe(false);
  });
});
