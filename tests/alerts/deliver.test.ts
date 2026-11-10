import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  lastEvent: null as { createdAt: Date } | null,
  events: [] as Record<string, unknown>[],
  notifications: [] as Record<string, unknown>[],
  emails: [] as string[],
  whatsapp: [] as string[],
  membershipWhere: null as unknown,
  org: { planId: "growth", whatsappOptIn: true, whatsappNumber: "+919800000000" },
}));

vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn(async () => state.org) },
    alertEvent: {
      findFirst: vi.fn(async () => state.lastEvent),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ev${state.events.length + 1}`, ...data };
        state.events.push(row);
        return row;
      }),
      update: vi.fn(async () => ({})),
    },
    notification: { createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => void state.notifications.push(...data)) },
    membership: {
      findMany: vi.fn(async (args: { where: unknown }) => {
        state.membershipWhere = args.where;
        return [{ userId: "u1", user: { email: "owner@shop.in" } }];
      }),
    },
  },
}));
vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async (o: { to: string }) => {
    state.emails.push(o.to);
    return { ok: true };
  }),
}));
vi.mock("@/lib/growth/deliver", () => ({
  canWhatsApp: () => true,
  whatsappOnce: vi.fn(async (o: { text: string }) => {
    state.whatsapp.push(o.text);
    return true;
  }),
}));

import { deliverAlerts, digestContent, isDigestTime, isDuplicate, planDelivery } from "@/lib/alerts/deliver";
import { DEFAULT_ALERT_CONFIG, readAlertConfig } from "@/lib/alerts/config";
import type { AlertCandidate } from "@/lib/alerts/rules";

const cand = (o: Partial<AlertCandidate> = {}): AlertCandidate => ({
  rule: "score_drop", dedupeKey: "overall", severity: "warning", title: "Score dropped", body: "From 80 to 70.", link: "/app/projects/p1/report", ...o,
});
const ctx = (config = DEFAULT_ALERT_CONFIG) => ({ organizationId: "org1", projectId: "p1", projectName: "Shop", config, now: new Date("2026-11-09T10:00:00Z") });

beforeEach(() => {
  state.lastEvent = null;
  state.events = [];
  state.notifications = [];
  state.emails = [];
  state.whatsapp = [];
});

describe("pure delivery rules", () => {
  it("de-duplicates inside the rule's cooldown", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    expect(isDuplicate(new Date("2026-11-09T00:00:00Z"), "score_drop", now)).toBe(true);
    expect(isDuplicate(new Date("2026-11-08T09:00:00Z"), "score_drop", now)).toBe(false);
    expect(isDuplicate(new Date("2026-11-05T09:00:00Z"), "search_clicks_drop", now)).toBe(true); // weekly
    expect(isDuplicate(null, "score_drop", now)).toBe(false);
  });
  it("daily digest defers email/WhatsApp except urgent alerts", () => {
    const daily = readAlertConfig({ digest: "daily" });
    expect(planDelivery(daily, "warning", { whatsappAllowed: true })).toEqual({ inApp: true, external: ["email", "whatsapp"], deferToDigest: true });
    expect(planDelivery(daily, "urgent", { whatsappAllowed: true }).deferToDigest).toBe(false);
    expect(planDelivery(DEFAULT_ALERT_CONFIG, "warning", { whatsappAllowed: false }).external).toEqual(["email"]);
  });
  it("digest goes out from 09:00 IST", () => {
    expect(isDigestTime(new Date("2026-11-09T03:00:00Z"))).toBe(false);
    expect(isDigestTime(new Date("2026-11-09T03:30:00Z"))).toBe(true);
    expect(digestContent("Shop", [{ title: "a", body: "b" }]).title).toBe("1 alert for Shop today");
  });
});

describe("deliverAlerts", () => {
  it("records, notifies in-app (org-wide by default), emails owners/admins and WhatsApps opted-in orgs", async () => {
    expect(await deliverAlerts(ctx(), [cand()])).toBe(1);
    expect(state.events[0]).toMatchObject({ organizationId: "org1", projectId: "p1", rule: "score_drop", status: "sent" });
    expect(state.notifications).toEqual([expect.objectContaining({ organizationId: "org1", userId: null, type: "alert" })]);
    expect(state.emails).toEqual(["owner@shop.in"]);
    expect(state.whatsapp).toHaveLength(1);
    expect(state.membershipWhere).toEqual({ organizationId: "org1", status: "active", role: { in: ["owner", "admin"] } });
  });

  it("skips an alert already sent in the last 24 hours", async () => {
    state.lastEvent = { createdAt: new Date("2026-11-09T02:00:00Z") };
    expect(await deliverAlerts(ctx(), [cand()])).toBe(0);
    expect(state.events).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
  });

  it("chosen recipients get their own in-app rows, scoped to the org's active members", async () => {
    await deliverAlerts(ctx(readAlertConfig({ recipients: ["u1"] })), [cand()]);
    expect(state.membershipWhere).toEqual({ organizationId: "org1", status: "active", userId: { in: ["u1"] } });
    expect(state.notifications).toEqual([expect.objectContaining({ userId: "u1" })]);
  });

  it("queues non-urgent alerts for the digest instead of emailing", async () => {
    await deliverAlerts(ctx(readAlertConfig({ digest: "daily" })), [cand()]);
    expect(state.events[0]).toMatchObject({ status: "pending_digest" });
    expect(state.emails).toHaveLength(0);
    expect(state.notifications).toHaveLength(1);
  });

  it("respects switched-off channels", async () => {
    await deliverAlerts(ctx(readAlertConfig({ channels: { inApp: false, email: false, whatsapp: false } })), [cand({ severity: "urgent" })]);
    expect(state.events).toHaveLength(1);
    expect(state.notifications).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
    expect(state.whatsapp).toHaveLength(0);
  });
});
