// Server-side loader for the public shared report page. Token → verified claims → project share settings → report.
import { db } from "@/lib/db";
import { buildSiteReport } from "@/lib/report/build";
import type { SiteReport } from "@/lib/report/types";
import { toPublicReport } from "@/lib/share/public-report";
import { isShareActive, verifyShareToken } from "@/lib/share/token";

export type SharedReportResult =
  | { status: "ok"; report: SiteReport }
  | { status: "not_ready"; brand: string }
  | { status: "not_found" };

const TTL_MS = 60_000;
const CACHE_MAX = 100;
/** Short cache so a link opened by many people doesn't rebuild the report on every view. Keyed by tokenId too, so revocation wins. */
const cache = new Map<string, { at: number; report: SiteReport }>();

export async function loadSharedReport(token: string): Promise<SharedReportResult> {
  const claims = await verifyShareToken(token);
  if (!claims) return { status: "not_found" };

  // Share settings are always re-read from the DB, so turning sharing off / rotating takes effect immediately.
  const project = await db.project.findUnique({
    where: { id: claims.projectId },
    select: { id: true, organizationId: true, name: true, brandNames: true, settings: true },
  });
  if (!project || !isShareActive(project.settings, claims)) return { status: "not_found" };

  const key = `${project.id}|${claims.tokenId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { status: "ok", report: hit.report };

  const report = await buildSiteReport(project.id, project.organizationId);
  if (!report.crawl.crawlRunId) {
    return { status: "not_ready", brand: report.brand };
  }
  const pub = toPublicReport(report);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), report: pub });
  return { status: "ok", report: pub };
}
