// Persistence for AI bot visit aggregates. Every query is scoped by organizationId + projectId. Writes for one project
// are serialized with a transaction-scoped advisory lock so concurrent uploads/ingests merge instead of overwriting.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BotAggregator, mergePaths, mergeStatusCounts, topPaths, type PathStat } from "./aggregate";

export class DuplicateImportError extends Error {
  constructor() {
    super("This exact log file was already imported, so it wasn't counted again.");
  }
}

export interface ImportMeta {
  source: "upload" | "ingest";
  fileName?: string | null;
  sha256?: string | null;
  bytes?: number;
  createdById?: string | null;
}

const asPaths = (v: unknown): PathStat[] =>
  Array.isArray(v)
    ? v.filter((p): p is PathStat => !!p && typeof p === "object" && typeof (p as PathStat).path === "string" && typeof (p as PathStat).hits === "number")
    : [];
const asCounts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, n] of Object.entries(v)) if (typeof n === "number") out[k] = n;
  return out;
};

function cutoffDate(historyDays: number, now = new Date()): string {
  return new Date(now.getTime() - historyDays * 86_400_000).toISOString().slice(0, 10);
}

/** Merge an aggregator into the daily rows and record the import (uploads only; ingest batches are too frequent). Returns the import id. */
export async function persistAggregates(
  scope: { organizationId: string; projectId: string },
  agg: BotAggregator,
  meta: ImportMeta,
  opts: { historyDays: number; now?: Date },
): Promise<string | null> {
  const { organizationId, projectId } = scope;
  const summary = agg.summary();
  const cutoff = cutoffDate(opts.historyDays, opts.now);
  const buckets = [...agg.buckets.values()].filter((b) => b.date >= cutoff);
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`aibots:${projectId}`}))`;
        const imp = meta.source === "ingest" ? null : await tx.aiBotLogImport.create({
          data: {
            organizationId, projectId, source: meta.source, fileName: meta.fileName?.slice(0, 200) ?? null, sha256: meta.sha256 ?? null,
            bytes: Math.min(meta.bytes ?? 0, 2_147_483_647), linesTotal: summary.linesTotal, linesParsed: summary.linesParsed,
            botHits: summary.botHits, firstDate: summary.firstDate, lastDate: summary.lastDate, createdById: meta.createdById ?? null,
          },
        });
        if (buckets.length) {
          const existing = await tx.aiBotDaily.findMany({
            where: { organizationId, projectId, OR: buckets.map((b) => ({ date: b.date, bot: b.bot })) },
          });
          const byKey = new Map(existing.map((r) => [`${r.date}|${r.bot}`, r]));
          for (const b of buckets) {
            const prev = byKey.get(`${b.date}|${b.bot}`);
            const newPaths = topPaths(b.paths.entries());
            if (prev) {
              await tx.aiBotDaily.update({
                where: { id: prev.id },
                data: {
                  hits: { increment: b.hits },
                  verifiedHits: { increment: b.verifiedHits },
                  unverifiedHits: { increment: b.unverifiedHits },
                  statusCounts: mergeStatusCounts(asCounts(prev.statusCounts), b.statusCounts) as Prisma.InputJsonValue,
                  topPaths: mergePaths(asPaths(prev.topPaths), newPaths) as unknown as Prisma.InputJsonValue,
                },
              });
            } else {
              await tx.aiBotDaily.create({
                data: {
                  organizationId, projectId, date: b.date, bot: b.bot, hits: b.hits, verifiedHits: b.verifiedHits, unverifiedHits: b.unverifiedHits,
                  statusCounts: b.statusCounts as Prisma.InputJsonValue, topPaths: newPaths as unknown as Prisma.InputJsonValue,
                },
              });
            }
          }
        }
        // Retention: drop days older than the plan keeps.
        await tx.aiBotDaily.deleteMany({ where: { organizationId, projectId, date: { lt: cutoff } } });
        return imp?.id ?? null;
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DuplicateImportError();
    throw e;
  }
}

export interface DailyRow {
  date: string;
  bot: string;
  hits: number;
  verifiedHits: number;
  unverifiedHits: number;
  statusCounts: Record<string, number>;
  topPaths: PathStat[];
}

export async function loadDailyRows(scope: { organizationId: string; projectId: string }, sinceDate: string): Promise<DailyRow[]> {
  const rows = await db.aiBotDaily.findMany({
    where: { organizationId: scope.organizationId, projectId: scope.projectId, date: { gte: sinceDate } },
    orderBy: [{ date: "asc" }, { bot: "asc" }],
    take: 20_000,
  });
  return rows.map((r) => ({
    date: r.date, bot: r.bot, hits: r.hits, verifiedHits: r.verifiedHits, unverifiedHits: r.unverifiedHits,
    statusCounts: asCounts(r.statusCounts), topPaths: asPaths(r.topPaths),
  }));
}

/** Uploads today (UTC) for the plan's per-day cap. */
export async function uploadsToday(scope: { organizationId: string; projectId: string }, now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return db.aiBotLogImport.count({ where: { organizationId: scope.organizationId, projectId: scope.projectId, source: "upload", createdAt: { gte: start } } });
}
