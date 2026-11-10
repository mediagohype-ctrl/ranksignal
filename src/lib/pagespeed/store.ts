// Reads for the report engine (tenant-scoped) + parsing of the stored JSON (pure, exported for tests).
import { db } from "@/lib/db";
import type { AuditDepthData, FieldScope, PageSpeedRow, ProbeResult, PsiRowStatus, PsiStrategy } from "@/lib/pagespeed/types";

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);

const DEPTH_STATUSES = ["queued", "running", "succeeded", "partial", "failed"] as const;

export function parseProbes(v: unknown): ProbeResult[] {
  if (!Array.isArray(v)) return [];
  const out: ProbeResult[] = [];
  for (const item of v) {
    const o = obj(item);
    if (!o || typeof o.url !== "string" || (o.kind !== "image" && o.kind !== "link" && o.kind !== "canonical")) continue;
    out.push({
      kind: o.kind,
      url: o.url,
      status: numOrNull(o.status),
      finalUrl: strOrNull(o.finalUrl),
      hops: numOrNull(o.hops) ?? 0,
      bytes: numOrNull(o.bytes),
      ...(o.bytesAtLeast === true ? { bytesAtLeast: true } : {}),
      contentType: strOrNull(o.contentType),
      error: strOrNull(o.error),
      pages: Array.isArray(o.pages) ? o.pages.filter((p): p is string => typeof p === "string").slice(0, 10) : [],
    });
  }
  return out;
}

export function parseStringList(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

type PsiRowRecord = {
  url: string; strategy: string; status: string; isHome: boolean; performanceScore: number | null;
  labLcpMs: number | null; labCls: number | null; labTbtMs: number | null; labFcpMs: number | null;
  fieldLcpMs: number | null; fieldInpMs: number | null; fieldCls: number | null; fieldFcpMs: number | null;
  fieldScope: string | null; error: string | null; fetchedAt: Date | null;
};

export function toPageSpeedRow(r: PsiRowRecord): PageSpeedRow {
  return {
    url: r.url,
    strategy: (r.strategy === "desktop" ? "desktop" : "mobile") as PsiStrategy,
    status: (["pending", "ok", "failed"].includes(r.status) ? r.status : "pending") as PsiRowStatus,
    isHome: r.isHome,
    performanceScore: r.performanceScore,
    labLcpMs: r.labLcpMs,
    labCls: r.labCls,
    labTbtMs: r.labTbtMs,
    labFcpMs: r.labFcpMs,
    fieldLcpMs: r.fieldLcpMs,
    fieldInpMs: r.fieldInpMs,
    fieldCls: r.fieldCls,
    fieldFcpMs: r.fieldFcpMs,
    fieldScope: (r.fieldScope === "url" || r.fieldScope === "origin" ? r.fieldScope : null) as FieldScope | null,
    error: r.error,
    fetchedAt: r.fetchedAt?.toISOString() ?? null,
  };
}

/** Audit-depth data for one crawl, or null when the pass never ran for it (older crawls). */
export async function loadAuditDepth(organizationId: string, crawlRunId: string): Promise<AuditDepthData | null> {
  const run = await db.auditDepthRun.findFirst({ where: { organizationId, crawlRunId } });
  if (!run) return null;
  const rows = await db.pageSpeedResult.findMany({
    where: { organizationId, crawlRunId },
    orderBy: [{ isHome: "desc" }, { createdAt: "asc" }],
    take: 100,
  });
  return {
    status: (DEPTH_STATUSES as readonly string[]).includes(run.status) ? (run.status as AuditDepthData["status"]) : "queued",
    finishedAt: run.finishedAt?.toISOString() ?? null,
    probed: run.probes !== null,
    probes: parseProbes(run.probes),
    sitemapNoindex: parseStringList(run.sitemapNoindex),
    pageSpeed: rows.map(toPageSpeedRow),
  };
}
