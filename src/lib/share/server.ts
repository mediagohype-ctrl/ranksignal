// Server-side loader for the public shared report page. Token → verified claims → project share settings → report.
// `token` is either the long signed token or a short-link slug (Project.settings.share.slug).
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import type { SiteReport } from "@/lib/report/types";
import { toPublicReport } from "@/lib/share/public-report";
import { isShareActive, isShareSlug, isSlugActive, readShareSettings, verifyShareToken, type ShareClaims } from "@/lib/share/token";

export type SharedReportResult =
  | { status: "ok"; report: SiteReport }
  | { status: "not_ready"; brand: string }
  | { status: "not_found" };

const TTL_MS = 60_000;
const CACHE_MAX = 100;
/** Short cache so a link opened by many people doesn't rebuild the report on every view. Keyed by tokenId too, so revocation wins. */
const cache = new Map<string, { at: number; report: SiteReport }>();

const PROJECT_SELECT = { id: true, organizationId: true, name: true, brandNames: true, settings: true } as const;

/**
 * The project behind a share link, only while that link is live (sharing on, same token / same short id).
 * Share settings are always re-read from the DB, so turning sharing off / replacing the link takes effect at once.
 */
export async function resolveShareLink(token: string) {
  if (isShareSlug(token)) {
    // JSON path lookup on Project.settings.share.slug. The slug's random part is the secret; isSlugActive re-checks it.
    const project = await db.project.findFirst({ where: { settings: { path: ["share", "slug"], equals: token } }, select: PROJECT_SELECT });
    if (!project || !isSlugActive(project.settings, token)) return null;
    const claims: ShareClaims = { projectId: project.id, tokenId: readShareSettings(project.settings)!.tokenId };
    return { project, claims };
  }
  const claims = await verifyShareToken(token);
  if (!claims) return null;
  const project = await db.project.findUnique({ where: { id: claims.projectId }, select: PROJECT_SELECT });
  if (!project || !isShareActive(project.settings, claims)) return null;
  return { project, claims };
}

export async function loadSharedReport(token: string): Promise<SharedReportResult> {
  const link = await resolveShareLink(token);
  if (!link) return { status: "not_found" };
  const { project, claims } = link;

  const key = `${project.id}|${claims.tokenId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { status: "ok", report: hit.report };

  // Stored report: anonymous viewers can never trigger an LLM call (or a full rebuild when one is stored).
  const report = await getStoredReport(project.id, project.organizationId);
  if (!report || !report.crawl.crawlRunId) {
    return { status: "not_ready", brand: report?.brand ?? project.name };
  }
  const pub = toPublicReport(report);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), report: pub });
  return { status: "ok", report: pub };
}
