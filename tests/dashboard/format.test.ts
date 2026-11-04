import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, fmtDate, fmtDateTime, fmtRelative, fmtTime, isValidTimeZone } from "@/lib/dashboard/format";
import { aiDoneMessage, crawlDoneMessage, runStatusPayload, toastDecision, SCORE_WAIT_MS } from "@/lib/dashboard/run-status";
import { projectIdFromPath } from "@/components/app/run-watcher";

// 2026-11-04 20:00 UTC = 5 Nov 01:30 in India, 4 Nov 15:00 in New York.
const AT = "2026-11-04T20:00:00Z";

describe("dates in the user's time zone", () => {
  it("defaults to India time, not the machine's zone", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Kolkata");
    expect(fmtDate(AT)).toBe("5 Nov 2026");
  });

  it("formats in the given zone", () => {
    expect(fmtDate(AT, false, "America/New_York")).toBe("4 Nov 2026");
    expect(fmtDate(AT, { timeZone: "UTC" })).toBe("4 Nov 2026");
    expect(fmtDateTime(AT)).toMatch(/^5 Nov 2026, 0?1:30\s?am$/i);
    expect(fmtDateTime(AT, "America/New_York")).toMatch(/^4 Nov 2026, 0?3:00\s?pm$/i);
    expect(fmtDate(AT, true, "UTC")).toMatch(/0?8:00\s?pm/i);
    expect(fmtTime(AT, "Asia/Kolkata")).toMatch(/^0?1:30\s?am$/i);
  });

  it("the same moment always shows the same text for a zone (server and browser agree)", () => {
    expect(fmtDateTime(new Date(AT), "Asia/Kolkata")).toBe(fmtDateTime(AT, "Asia/Kolkata"));
    expect(fmtDateTime(Date.parse(AT), "Asia/Kolkata")).toBe(fmtDateTime(AT, "Asia/Kolkata"));
  });

  it("falls back safely on bad input", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("not a date")).toBe("—");
    expect(fmtDate(AT, false, "Mars/Olympus")).toBe("5 Nov 2026");
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("nope")).toBe(false);
  });

  it("relative times, then the date after a week", () => {
    const now = Date.parse(AT);
    expect(fmtRelative(new Date(now - 30_000), null, now)).toBe("just now");
    expect(fmtRelative(new Date(now - 5 * 60_000), null, now)).toBe("5m ago");
    expect(fmtRelative(new Date(now - 3 * 3600_000), null, now)).toBe("3h ago");
    expect(fmtRelative(new Date(now - 2 * 86400_000), null, now)).toBe("2d ago");
    expect(fmtRelative(new Date(now - 10 * 86400_000), "UTC", now)).toBe("25 Oct 2026");
  });
});

describe("run-finished toasts", () => {
  const since = Date.parse("2026-11-04T10:00:00Z");
  const item = (o: Partial<{ id: string; status: string; finishedAt: string | null; active: boolean; done: boolean; scoreReady: boolean }>) => ({
    id: "r1",
    status: "succeeded",
    finishedAt: "2026-11-04T10:05:00Z",
    active: false,
    done: true,
    ...o,
  });

  it("toasts when a run it saw running finishes", () => {
    expect(toastDecision(item({ status: "running", active: true, done: false, finishedAt: null }), item({}), since)).toBe("toast");
  });

  it("toasts a new run that finished after the page opened, but not old runs", () => {
    expect(toastDecision(null, item({}), since)).toBe("toast");
    expect(toastDecision(null, item({ finishedAt: "2026-11-04T09:00:00Z" }), since)).toBeNull();
    expect(toastDecision(item({}), item({}), since)).toBeNull(); // same finished run seen before
  });

  it("waits briefly for the score before announcing a website check", () => {
    const fin = Date.parse("2026-11-04T10:05:00Z");
    expect(toastDecision(null, item({ scoreReady: false }), since, fin + 5_000)).toBe("wait");
    expect(toastDecision(null, item({ scoreReady: false }), since, fin + SCORE_WAIT_MS + 1)).toBe("toast");
    expect(toastDecision(null, item({ active: true }), since)).toBeNull();
  });

  it("writes the messages in plain words", () => {
    const p = runStatusPayload(
      { id: "c", status: "succeeded", finishedAt: new Date(AT) },
      { overallScore: 51 },
      { id: "v", status: "succeeded", finishedAt: new Date(AT), collected: 30, metrics: { mentionRate: 0.1, collected: 30 } },
    );
    expect(crawlDoneMessage(p.crawl!).message).toBe("Website check done. Score 51.");
    expect(aiDoneMessage(p.visibility!).message).toBe("AI check done. AI named you in 3 of 30 answers.");
    expect(crawlDoneMessage({ ...p.crawl!, done: false, status: "failed" }).tone).toBe("error");
  });

  it("finds the project being viewed", () => {
    expect(projectIdFromPath("/app/projects/abc123/report")).toBe("abc123");
    expect(projectIdFromPath("/app/projects/new")).toBeNull();
    expect(projectIdFromPath("/app/settings")).toBeNull();
  });
});
