// Aggregate queries for the admin back-office. Everything is grouped/counted in the database.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { DAY_MS, dayKeys } from "./params";

/* ------------------------------------------------------------------ daily series (Postgres) */

const DAILY_TABLES = {
  User: "User",
  Organization: "Organization",
  CrawlRun: "CrawlRun",
  VisibilityRun: "VisibilityRun",
  Lead: "Lead",
} as const;

/** Rows per UTC day since `since`, zero-filled. */
export async function dailyCounts(table: keyof typeof DAILY_TABLES, since: Date): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ day: string; n: number }[]>(
    Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
               FROM ${Prisma.raw(`"${DAILY_TABLES[table]}"`)}
               WHERE "createdAt" >= ${since}
               GROUP BY 1`,
  );
  const out = new Map(dayKeys(since).map((k) => [k, 0]));
  for (const r of rows) out.set(r.day, Number(r.n));
  return out;
}

/** Actual AI/provider cost (micro-USD) per UTC day and provider. Optionally for one org. */
export async function dailyCostByProvider(since: Date, organizationId?: string) {
  const rows = await db.$queryRaw<{ day: string; provider: string; micros: bigint | number }[]>(
    Prisma.sql`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, provider,
                      COALESCE(SUM("costMicros"), 0)::bigint AS micros
               FROM "UsageLedger"
               WHERE kind = 'actual' AND "createdAt" >= ${since}
               ${organizationId ? Prisma.sql`AND "organizationId" = ${organizationId}` : Prisma.empty}
               GROUP BY 1, 2`,
  );
  const providers = [...new Set(rows.map((r) => r.provider))].sort();
  const byDay = new Map<string, Record<string, number>>(dayKeys(since).map((k) => [k, Object.fromEntries(providers.map((p) => [p, 0]))]));
  for (const r of rows) {
    const d = byDay.get(r.day) ?? {};
    d[r.provider] = Number(r.micros) / 1_000_000;
    byDay.set(r.day, d);
  }
  return {
    providers,
    data: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day: day.slice(5), ...v })),
  };
}

export function seriesFromMap(...series: { key: string; map: Map<string, number> }[]) {
  const days = [...new Set(series.flatMap((s) => [...s.map.keys()]))].sort();
  return days.map((day) => ({ day: day.slice(5), ...Object.fromEntries(series.map((s) => [s.key, s.map.get(day) ?? 0])) }));
}

/* ------------------------------------------------------------------ trials */

export interface TrialOrg {
  id: string;
  name: string;
  createdAt: Date;
  trialEndsAt: Date;
}

/** Trial end = newest "trialing" subscription's trialEndsAt, else createdAt + TRIAL_DAYS (mirrors billing/access.ts). */
export function trialEndFor(org: { createdAt: Date }, trialSubs: { trialEndsAt: Date | null }[]): Date {
  const sub = trialSubs.find((s) => s.trialEndsAt);
  return sub?.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export async function loadTrialOrgs(limit = 5000): Promise<TrialOrg[]> {
  const orgs = await db.organization.findMany({
    where: { planId: "trial", status: { notIn: ["cancelled", "suspended"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscriptions: {
        where: { status: "trialing", trialEndsAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { trialEndsAt: true },
      },
    },
  });
  return orgs.map((o) => ({ id: o.id, name: o.name, createdAt: o.createdAt, trialEndsAt: trialEndFor(o, o.subscriptions) }));
}

export function bucketTrials(trials: TrialOrg[], now = new Date()) {
  const soon = now.getTime() + 7 * DAY_MS;
  const active = trials.filter((t) => t.trialEndsAt.getTime() > now.getTime());
  return {
    active,
    expiringSoon: active.filter((t) => t.trialEndsAt.getTime() <= soon).sort((a, b) => a.trialEndsAt.getTime() - b.trialEndsAt.getTime()),
    expired: trials.filter((t) => t.trialEndsAt.getTime() <= now.getTime()),
  };
}

/* ------------------------------------------------------------------ org enrichment for tables */

/** Last activity (latest workflow run or audit event), credits used and AI cost this period for a page of orgs. */
export async function orgActivity(orgIds: string[], period: string) {
  if (orgIds.length === 0) return new Map<string, { lastActivity: Date | null; credits: number; costMicros: number }>();
  const [runs, audits, usage] = await Promise.all([
    db.workflowRun.groupBy({ by: ["organizationId"], where: { organizationId: { in: orgIds } }, _max: { createdAt: true } }),
    db.auditLog.groupBy({ by: ["organizationId"], where: { organizationId: { in: orgIds } }, _max: { createdAt: true } }),
    db.usageLedger.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds }, billingPeriod: period, kind: "actual" },
      _sum: { credits: true, costMicros: true },
    }),
  ]);
  const out = new Map<string, { lastActivity: Date | null; credits: number; costMicros: number }>();
  for (const id of orgIds) out.set(id, { lastActivity: null, credits: 0, costMicros: 0 });
  const bump = (id: string | null, d: Date | null) => {
    if (!id || !d) return;
    const e = out.get(id);
    if (e && (!e.lastActivity || d > e.lastActivity)) e.lastActivity = d;
  };
  runs.forEach((r) => bump(r.organizationId, r._max.createdAt));
  audits.forEach((r) => bump(r.organizationId, r._max.createdAt));
  for (const u of usage) {
    const e = out.get(u.organizationId);
    if (e) {
      e.credits = u._sum.credits ?? 0;
      e.costMicros = u._sum.costMicros ?? 0;
    }
  }
  return out;
}

export async function orgNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const rows = await db.organization.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function userEmails(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const rows = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
  return new Map(rows.map((r) => [r.id, r.email]));
}
