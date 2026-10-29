import { describe, expect, it } from "vitest";
import { inviteTokenFromNext, safeNext } from "@/app/(auth)/safe-next";

const ORIGIN = "https://ranksignal.onrender.com";
const s = (next: string | null) => safeNext(next, "/app", ORIGIN);

describe("safeNext (open redirect)", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(s("/app/projects/1?tab=a#x")).toBe("/app/projects/1?tab=a#x");
    expect(s("/accept-invite?token=abc.def.ghi")).toBe("/accept-invite?token=abc.def.ghi");
    expect(s("/app/onboarding?website=https%3A%2F%2Facme.example%2F")).toBe("/app/onboarding?website=https%3A%2F%2Facme.example%2F");
  });

  it.each([
    null,
    "",
    "app",
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/%2F/evil.example",
    "/%2f%2fevil.example",
    "%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%5cevil.example",
    "/%252F%252Fevil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "/%E0%A4%A",
  ])("rejects %j", (next) => {
    expect(s(next)).toBe("/app");
  });

  it("rejects overly long values", () => {
    expect(s(`/${"a".repeat(3000)}`)).toBe("/app");
  });
});

describe("inviteTokenFromNext", () => {
  it("extracts the invite token only from /accept-invite", () => {
    expect(inviteTokenFromNext("/accept-invite?token=abcdefghijkl")).toBe("abcdefghijkl");
    expect(inviteTokenFromNext("/app?token=abcdefghijkl")).toBeUndefined();
    expect(inviteTokenFromNext("/accept-invite")).toBeUndefined();
  });
});
