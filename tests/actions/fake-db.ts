// Minimal in-memory stand-in for the Prisma client methods used by actions code.
type Row = Record<string, unknown> & { id: string };

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    const v = row[k];
    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(v);
      if ("not" in c) return c.not === null ? v != null : v !== c.not;
      return JSON.stringify(v) === JSON.stringify(cond);
    }
    return v === cond;
  });
}

let seq = 0;
function collection(defaults: (d: Record<string, unknown>) => Record<string, unknown> = () => ({})) {
  const rows: Row[] = [];
  return {
    rows,
    async findFirst(a: { where?: Record<string, unknown> } = {}) {
      const m = rows.filter((r) => matches(r, a.where));
      return m.length ? m[m.length - 1] : null;
    },
    async findUnique(a: { where: Record<string, unknown> }) {
      return rows.find((r) => matches(r, a.where)) ?? null;
    },
    async findMany(a: { where?: Record<string, unknown> } = {}) {
      return rows.filter((r) => matches(r, a.where));
    },
    async create(a: { data: Record<string, unknown> }) {
      if ("idempotencyKey" in a.data && rows.some((r) => r.idempotencyKey === a.data.idempotencyKey)) {
        throw new Error("unique constraint");
      }
      const row = { id: `id${++seq}`, createdAt: new Date(Date.now() + seq), ...defaults(a.data), ...a.data } as Row;
      rows.push(row);
      return row;
    },
    async update(a: { where: { id?: string; key?: string }; data: Record<string, unknown> }) {
      const row = rows.find((r) => matches(r, a.where as Record<string, unknown>));
      if (!row) throw new Error("not found");
      Object.assign(row, a.data);
      return row;
    },
    async updateMany(a: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const m = rows.filter((r) => matches(r, a.where));
      m.forEach((r) => Object.assign(r, a.data));
      return { count: m.length };
    },
    async delete(a: { where: { id: string } }) {
      const i = rows.findIndex((r) => r.id === a.where.id);
      return rows.splice(i, 1)[0];
    },
  };
}

export function createFakeDb() {
  return {
    action: collection(),
    approval: collection(),
    actionExecution: collection((d) => ({ startedAt: new Date(), result: d.result ?? "pending" })),
    notification: collection(),
    project: collection(),
    organization: collection(),
    integration: collection(),
    featureFlag: collection(),
    auditLog: collection(),
    workflowRun: collection(),
  };
}
export type FakeDb = ReturnType<typeof createFakeDb>;
