// Minimal in-memory stand-in for the Prisma models the Google module touches.
type Row = Record<string, unknown> & { id: string };

export interface FakeState {
  integrations: Row[];
  metrics: Row[];
  notifications: Row[];
  audit: Row[];
  projects: Row[];
}

export function newState(): FakeState {
  return { integrations: [], metrics: [], notifications: [], audit: [], projects: [] };
}

function matches(r: Row, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(r, w));
    const v = r[k];
    if (cond === null) return v === null || v === undefined;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c && !(c.in as unknown[]).includes(v)) return false;
      if ("not" in c && (c.not === null ? v === null || v === undefined : v === c.not)) return false;
      if ("gte" in c && !((v as never) >= (c.gte as never))) return false;
      if ("lte" in c && !((v as never) <= (c.lte as never))) return false;
      if ("lt" in c && !(v !== null && v !== undefined && (v as never) < (c.lt as never))) return false;
      return true;
    }
    return v === cond;
  });
}

let seq = 0;
const id = (p: string) => `${p}${++seq}`;
const uniqueKey = (r: Row) => [r.projectId, r.source, r.date, r.dimension, r.key].join("|");

export function makeDb(s: FakeState) {
  return {
    project: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => s.projects.find((p) => matches(p, where)) ?? null,
    },
    integration: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => s.integrations.find((r) => matches(r, where)) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => s.integrations.filter((r) => matches(r, where)),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { lastSyncAt: null, createdAt: new Date(), ...data, id: id("int") } as Row;
        s.integrations.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = s.integrations.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        return Object.assign(row, data);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = s.integrations.findIndex((r) => r.id === where.id);
        return s.integrations.splice(i, 1)[0];
      },
    },
    metricDaily: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = s.metrics.length;
        s.metrics = s.metrics.filter((r) => !matches(r, where));
        return { count: before - s.metrics.length };
      },
      createMany: async ({ data, skipDuplicates }: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of data) {
          const row = { ...d, id: id("m") } as Row;
          if (s.metrics.some((m) => uniqueKey(m) === uniqueKey(row))) {
            if (skipDuplicates) continue;
            throw new Error("Unique constraint failed");
          }
          s.metrics.push(row);
          count++;
        }
        return { count };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => s.metrics.filter((r) => matches(r, where)),
      groupBy: async ({ where, take }: { where: Record<string, unknown>; take?: number }) => {
        const g = new Map<string, { key: string; clicks: number; impressions: number; pos: number[] }>();
        for (const r of s.metrics.filter((m) => matches(m, where))) {
          const k = r.key as string;
          const e = g.get(k) ?? { key: k, clicks: 0, impressions: 0, pos: [] };
          e.clicks += (r.clicks as number) ?? 0;
          e.impressions += (r.impressions as number) ?? 0;
          if (typeof r.position === "number") e.pos.push(r.position);
          g.set(k, e);
        }
        const out = [...g.values()]
          .sort((a, b) => b.clicks - a.clicks)
          .map((e) => ({
            key: e.key,
            _sum: { clicks: e.clicks, impressions: e.impressions },
            _avg: { position: e.pos.length ? e.pos.reduce((x, y) => x + y, 0) / e.pos.length : null },
          }));
        return take ? out.slice(0, take) : out;
      },
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: id("n") } as Row;
        s.notifications.push(row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: id("a") } as Row;
        s.audit.push(row);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => {
      const out: unknown[] = [];
      for (const op of ops) out.push(await op);
      return out;
    },
  };
}
