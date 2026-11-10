// Small in-memory stand-in for the Prisma calls the rank tracker makes (routes, service, job, scheduler entry).
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function cmp(v: unknown, cond: unknown): boolean {
  if (cond === null) return v === null || v === undefined;
  if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
  if (typeof cond !== "object") return v === cond;
  const c = cond as Record<string, unknown>;
  if ("in" in c && !(c.in as unknown[]).includes(v)) return false;
  const t = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
  if ("lt" in c && !(v !== null && v !== undefined && t(v) < t(c.lt))) return false;
  if ("gte" in c && !(v !== null && v !== undefined && t(v) >= t(c.gte))) return false;
  return true;
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Where[]).some((w) => matches(row, w));
    if (k === "AND") return (cond as Where[]).every((w) => matches(row, w));
    return cmp(row[k], cond);
  });
}

export function createFakeDb() {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const t = {
    projects: [
      { id: "p1", organizationId: "o1", websiteUrl: "https://www.acme.in/", name: "Acme" },
      { id: "p2", organizationId: "o2", websiteUrl: "https://other.in/", name: "Other" },
    ] as Row[],
    orgs: { o1: { planId: "trial" }, o2: { planId: "growth" } } as Record<string, { planId: string }>,
    keywords: [] as Row[],
    checks: [] as Row[],
    states: [] as Row[],
    stars: [] as Row[],
    usage: [] as Row[],
    runs: [] as Row[],
  };
  const sortBy = (rows: Row[], orderBy: unknown) => {
    const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    const out = [...rows];
    for (const o of [...list].reverse()) {
      const [k, dir] = Object.entries(o as Record<string, unknown>)[0];
      const d = (typeof dir === "string" ? dir : "asc") === "desc" ? -1 : 1;
      out.sort((a, b) => {
        const av = a[k] instanceof Date ? (a[k] as Date).getTime() : (a[k] as number | string);
        const bv = b[k] instanceof Date ? (b[k] as Date).getTime() : (b[k] as number | string);
        return av === bv ? 0 : av > bv ? d : -d;
      });
    }
    return out;
  };

  const db = {
    project: { findFirst: async ({ where }: { where: Where }) => t.projects.find((p) => matches(p, where)) ?? null },
    organization: { findUnique: async ({ where }: { where: { id: string } }) => t.orgs[where.id] ?? null },
    trackedKeyword: {
      count: async ({ where }: { where: Where }) => t.keywords.filter((k) => matches(k, where)).length,
      findMany: async ({ where, orderBy, take }: { where: Where; orderBy?: unknown; take?: number }) =>
        sortBy(t.keywords.filter((k) => matches(k, where)), orderBy).slice(0, take ?? 10_000),
      findFirst: async ({ where }: { where: Where }) => t.keywords.find((k) => matches(k, where)) ?? null,
      createMany: async ({ data }: { data: Row[] }) => {
        for (const d of data) {
          t.keywords.push({
            id: id("k"), active: true, lastCheckedAt: null, lastPosition: null, bestPosition: null, lastUrl: null, lastFeatures: null,
            lastCompetitors: null, lastError: null, createdAt: new Date(Date.now() + n), language: "en", ...d,
          });
        }
        return { count: data.length };
      },
      updateMany: async ({ where, data }: { where: Where; data: Row }) => {
        const rows = t.keywords.filter((k) => matches(k, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = t.keywords.find((k) => k.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: { where: Where }) => {
        const before = t.keywords.length;
        t.keywords = t.keywords.filter((k) => !matches(k, where));
        return { count: before - t.keywords.length };
      },
      groupBy: async ({ where }: { where: Where }) => {
        const map = new Map<string, Row>();
        for (const k of t.keywords.filter((k) => matches(k, where))) map.set(`${k.organizationId}:${k.projectId}`, { organizationId: k.organizationId, projectId: k.projectId, _count: { _all: 1 } });
        return [...map.values()];
      },
    },
    rankCheck: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: id("c"), ...data };
        t.checks.push(row);
        return row;
      },
      findMany: async ({ where, orderBy }: { where: Where; orderBy?: unknown }) => sortBy(t.checks.filter((c) => matches(c, where)), orderBy),
    },
    rankTrackerState: {
      findFirst: async ({ where }: { where: Where }) => t.states.find((s) => matches(s, where)) ?? null,
      upsert: async ({ where, create, update }: { where: { projectId: string }; create: Row; update: Row }) => {
        const row = t.states.find((s) => s.projectId === where.projectId);
        if (row) return Object.assign(row, Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)));
        const fresh = { id: id("s"), status: "active", message: null, lastRunAt: null, lastManualCheckAt: null, ...create };
        t.states.push(fresh);
        return fresh;
      },
    },
    keywordStar: { findMany: async ({ where }: { where: Where }) => t.stars.filter((s) => matches(s, where)) },
    workflowRun: { findFirst: async ({ where }: { where: Where }) => t.runs.find((r) => matches(r, where)) ?? null },
    dataForSeoUsage: {
      aggregate: async ({ where }: { where: Where }) => ({ _sum: { units: t.usage.filter((u) => matches(u, where)).reduce((s, u) => s + (u.units as number), 0) } }),
      create: async ({ data }: { data: Row }) => {
        const row = { id: id("u"), createdAt: new Date(), ...data };
        t.usage.push(row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { db, t };
}
