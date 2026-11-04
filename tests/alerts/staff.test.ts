import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const h = vi.hoisted(() => ({
  rows: new Set<string>(),
  deleted: [] as string[],
  emails: [] as { to: string; subject: string }[],
  whatsapp: [] as { to: string; text: string }[],
  emailOk: true,
}));

vi.mock("@/lib/db", () => ({
  db: {
    sentMessage: {
      create: vi.fn(async ({ data }: { data: { kind: string; key: string } }) => {
        const k = `${data.kind}|${data.key}`;
        if (h.rows.has(k)) throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        h.rows.add(k);
        return { id: k };
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        h.rows.delete(where.id);
        h.deleted.push(where.id);
      }),
    },
  },
}));
vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async (o: { to: string; subject: string }) => {
    h.emails.push(o);
    return { ok: h.emailOk };
  }),
}));

import { sendStaffAlert } from "@/lib/alerts/staff";
import { normalizeWhatsAppNumber, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/whatsapp/send";

const alert = { kind: "ai_budget_80", key: "2026-11-04", subject: "AI spend at 80%", text: "Spend is $4.00 of $5.00." };

beforeEach(() => {
  h.rows.clear();
  h.deleted = [];
  h.emails = [];
  h.whatsapp = [];
  h.emailOk = true;
  vi.stubEnv("STAFF_ALERT_EMAIL", "ops@example.com, owner@example.com");
  vi.stubEnv("STAFF_WHATSAPP", "");
  vi.stubEnv("WHATSAPP_TOKEN", "");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendStaffAlert", () => {
  it("emails every STAFF_ALERT_EMAIL once per kind+key (stored as staff_<kind>)", async () => {
    expect(await sendStaffAlert(alert)).toMatchObject({ status: "sent", email: true, whatsapp: false });
    expect(await sendStaffAlert(alert)).toEqual({ status: "duplicate" });
    expect(h.emails.map((e) => e.to)).toEqual(["ops@example.com", "owner@example.com"]);
    expect([...h.rows]).toEqual(["staff_ai_budget_80|2026-11-04"]);
  });

  it("skips (and records nothing) when no channel is configured", async () => {
    vi.stubEnv("STAFF_ALERT_EMAIL", "");
    expect(await sendStaffAlert(alert)).toMatchObject({ status: "skipped" });
    expect(h.rows.size).toBe(0);
  });

  it("forgets the dedupe row when nothing went out, so a later attempt retries", async () => {
    h.emailOk = false;
    expect(await sendStaffAlert(alert)).toEqual({ status: "failed" });
    expect(h.rows.size).toBe(0);
    h.emailOk = true;
    expect((await sendStaffAlert(alert)).status).toBe("sent");
  });

  it("also sends WhatsApp to STAFF_WHATSAPP through the Cloud API when configured", async () => {
    vi.stubEnv("STAFF_WHATSAPP", "+91 98765 43210");
    vi.stubEnv("WHATSAPP_TOKEN", "tok");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    const f = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect(await sendStaffAlert(alert)).toMatchObject({ status: "sent", email: true, whatsapp: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/12345/messages");
    expect(JSON.parse(String(init.body))).toMatchObject({ messaging_product: "whatsapp", to: "919876543210", type: "text" });
  });
});

describe("whatsapp", () => {
  it("is a no-op without WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await sendWhatsApp("+919876543210", "hi")).toEqual({ ok: false, skipped: true });
    expect(f).not.toHaveBeenCalled();
  });
  it("normalises numbers and rejects junk", () => {
    expect(normalizeWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("12")).toBeNull();
  });
  it("sends templates with body parameters", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "tok");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await sendWhatsAppTemplate("919876543210", { name: "staff_alert", params: ["hello"] });
    const body = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.template).toEqual({ name: "staff_alert", language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: "hello" }] }] });
  });
});
