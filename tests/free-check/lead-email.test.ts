// "Email me my full result": validation, which leads may take an email, and the public route.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({ lead: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { decideLeadEmail, LEAD_EMAIL_WINDOW_MS, leadEmailSchema } from "@/lib/free-check/lead-email";
import { POST } from "@/app/api/public/free-check/email/route";

const LEAD_ID = "clx1234567890abcdef";
let ipSeq = 0;
const req = (body: unknown, ip = `203.0.113.${++ipSeq % 250}`) =>
  new Request("http://localhost/api/public/free-check/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("leadEmailSchema", () => {
  it("lower-cases and trims the email", () => {
    expect(leadEmailSchema.parse({ leadId: LEAD_ID, email: "  Owner@Shop.IN " })).toEqual({ leadId: LEAD_ID, email: "owner@shop.in" });
  });
  it.each([
    [{ leadId: LEAD_ID, email: "not-an-email" }],
    [{ leadId: LEAD_ID }],
    [{ leadId: "short", email: "a@b.co" }],
    [{ leadId: "../../etc/passwd!", email: "a@b.co" }],
    [{ leadId: LEAD_ID, email: `${"x".repeat(250)}@b.co` }],
  ])("rejects %j", (body) => {
    expect(leadEmailSchema.safeParse(body).success).toBe(false);
  });
});

describe("decideLeadEmail", () => {
  const now = Date.parse("2026-11-04T10:00:00Z");
  const fresh = { source: "free_check", email: null, createdAt: new Date(now - 60_000) };
  it("accepts a fresh free-check lead", () => {
    expect(decideLeadEmail(fresh, "a@b.co", now)).toEqual({ ok: true, changed: true });
    expect(decideLeadEmail({ ...fresh, email: "a@b.co" }, "a@b.co", now)).toEqual({ ok: true, changed: false });
  });
  it("refuses unknown, non-free-check, expired, and already-claimed leads", () => {
    expect(decideLeadEmail(null, "a@b.co", now)).toEqual({ ok: false, reason: "not_found" });
    expect(decideLeadEmail({ ...fresh, source: "contact" }, "a@b.co", now)).toEqual({ ok: false, reason: "not_found" });
    expect(decideLeadEmail({ ...fresh, createdAt: new Date(now - LEAD_EMAIL_WINDOW_MS - 1) }, "a@b.co", now)).toEqual({ ok: false, reason: "expired" });
    expect(decideLeadEmail({ ...fresh, email: "first@b.co" }, "other@b.co", now)).toEqual({ ok: false, reason: "taken" });
  });
});

describe("POST /api/public/free-check/email", () => {
  it("stores the email on the free-check lead", async () => {
    mockDb.lead.findUnique.mockResolvedValue({ id: LEAD_ID, source: "free_check", email: null, createdAt: new Date() });
    const res = await POST(req({ leadId: LEAD_ID, email: "Owner@Shop.in" }));
    expect(res.status).toBe(200);
    expect(mockDb.lead.update).toHaveBeenCalledWith({ where: { id: LEAD_ID }, data: { email: "owner@shop.in" } });
  });
  it("400s on invalid input without touching the database", async () => {
    const res = await POST(req({ leadId: LEAD_ID, email: "nope" }));
    expect(res.status).toBe(400);
    expect(mockDb.lead.findUnique).not.toHaveBeenCalled();
  });
  it("404s for unknown leads", async () => {
    mockDb.lead.findUnique.mockResolvedValue(null);
    const res = await POST(req({ leadId: LEAD_ID, email: "a@b.co" }));
    expect(res.status).toBe(404);
    expect(mockDb.lead.update).not.toHaveBeenCalled();
  });
  it("ignores honeypot submissions", async () => {
    const res = await POST(req({ leadId: LEAD_ID, email: "a@b.co", website: "spam" }));
    expect(res.status).toBe(200);
    expect(mockDb.lead.findUnique).not.toHaveBeenCalled();
  });
  it("rate-limits one connection after 5 tries an hour", async () => {
    mockDb.lead.findUnique.mockResolvedValue(null);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(req({ leadId: LEAD_ID, email: "a@b.co" }, "198.51.100.7"))).status);
    expect(statuses.slice(0, 5).every((s) => s === 404)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
