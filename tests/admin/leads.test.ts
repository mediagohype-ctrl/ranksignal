import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({ lead: { create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/send", () => ({ sendEmail }));

import { hashIp, leadRowData, leadsToCsv, recordLead } from "@/lib/admin/leads";
import { POST as contactPost } from "@/app/api/public/contact/route";

const SECRET = "test-session-secret-0123456789-abcdefghijkl";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SESSION_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("hashIp", () => {
  it("is the first 32 hex chars of sha256(ip + SESSION_SECRET)", () => {
    const expected = createHash("sha256").update(`203.0.113.7${SECRET}`).digest("hex").slice(0, 32);
    expect(hashIp("203.0.113.7")).toBe(expected);
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("depends on the secret and never contains the raw IP", () => {
    const a = hashIp("203.0.113.7", "secret-a");
    const b = hashIp("203.0.113.7", "secret-b");
    expect(a).not.toBe(b);
    expect(a).not.toContain("203.0.113.7");
  });

  it("returns null for missing / unknown IPs", () => {
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp("unknown")).toBeNull();
  });
});

describe("lead rows", () => {
  it("store only the hash, never the raw IP", () => {
    const row = leadRowData({ source: "free_check", url: "https://acme.com/", score: 71.6, ip: "198.51.100.23" });
    expect(row.ipHash).toBe(hashIp("198.51.100.23"));
    expect(row.score).toBe(72);
    expect(JSON.stringify(row)).not.toContain("198.51.100.23");
  });

  it("recordLead never throws when the database fails", async () => {
    mockDb.lead.create.mockRejectedValueOnce(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(recordLead({ source: "contact", email: "a@b.com", ip: "1.1.1.1" })).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("CSV export escapes quotes/commas and neutralises formulas", () => {
    const csv = leadsToCsv([{ id: "l1", name: 'Ann "A", Co', message: "=HYPERLINK(1)" }]);
    expect(csv.split("\r\n")[1]).toBe('l1,,,,"Ann ""A"", Co",,,,,\'=HYPERLINK(1),');
  });
});

describe("POST /api/public/contact lead capture", () => {
  it("inserts a contact lead with a hashed IP and does not wait for it", async () => {
    mockDb.lead.create.mockResolvedValue({ id: "lead1" });
    sendEmail.mockResolvedValue({ ok: true });
    const req = new Request("http://localhost/api/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.44" },
      body: JSON.stringify({ name: "Priya", email: "Priya@Acme.com", company: "Acme", message: "We need help with AI visibility." }),
    });
    const res = await contactPost(req);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockDb.lead.create).toHaveBeenCalledOnce();
    const data = mockDb.lead.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ source: "contact", name: "Priya", email: "priya@acme.com", company: "Acme", ipHash: hashIp("192.0.2.44") });
    expect(JSON.stringify(data)).not.toContain("192.0.2.44");
  });

  it("still answers when the lead insert fails", async () => {
    mockDb.lead.create.mockRejectedValue(new Error("db down"));
    sendEmail.mockResolvedValue({ ok: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const req = new Request("http://localhost/api/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.45" },
      body: JSON.stringify({ name: "Ravi", email: "ravi@example.com", message: "Please call me back about pricing." }),
    });
    const res = await contactPost(req);
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    warn.mockRestore();
  });
});
