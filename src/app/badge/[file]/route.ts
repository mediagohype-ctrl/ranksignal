// GET /badge/<badge token>.svg — public "Found Score 82" badge.
// GET /badge/<badge token>     — where a click on the badge goes: the shared report while sharing is on, else our
//                                home page (the link pasted on a website must never dead-end).
// Access: signed token + the project's badge switch (Project.settings.badge — its own on/off, independent of the
// report share link; older badges without that switch follow the share link as before). See isBadgeActive.
// The score is the stored overall score (getStoredReport — never an LLM call). Cached for an hour at the edge.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { isBadgeActive, isShareActive, readShareSettings, shareUrl, signShareToken, verifyShareToken } from "@/lib/share/token";
import { getStoredReport } from "@/lib/report/stored";
import { renderBadgeSvg } from "@/lib/growth/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ file: string }> };

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; score: number | null }>();

function svgResponse(svg: string, status = 200, maxAge = 3600) {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": status === 200 ? `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400` : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // An SVG opened directly must not run anything.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

async function badgeProject(token: string) {
  const claims = await verifyShareToken(token).catch(() => null);
  if (!claims) return null;
  const project = await db.project.findUnique({ where: { id: claims.projectId }, select: { id: true, organizationId: true, settings: true } });
  if (!project || !isBadgeActive(project.settings, claims)) return null;
  return { project, claims };
}

/** Where a click on the badge goes: the live shared report, else the home page. */
async function clickTarget(project: { id: string; settings: unknown }, token: string, claims: { projectId: string; tokenId: string }): Promise<string> {
  const share = readShareSettings(project.settings);
  if (!share?.enabled) return BRAND.appUrl;
  if (isShareActive(project.settings, claims)) return shareUrl(share.slug ?? token);
  return shareUrl(share.slug ?? (await signShareToken({ projectId: project.id, tokenId: share.tokenId })));
}

export async function GET(req: Request, { params }: Ctx) {
  const { file } = await params;
  const home = BRAND.appUrl;
  const isSvg = file.endsWith(".svg");
  const notFound = () =>
    isSvg ? svgResponse(renderBadgeSvg({ score: null, link: home }), 404) : Response.redirect(home, 302);
  if (!checkRateLimit(`badge:${clientIp(req)}`, 120, 60_000).allowed) return notFound();
  const token = decodeURIComponent(isSvg ? file.slice(0, -4) : file);
  const found = await badgeProject(token);
  if (!found) return notFound();
  const { project, claims } = found;
  const link = new URL(`/badge/${encodeURIComponent(token)}`, home).toString();

  if (!isSvg) return Response.redirect(await clickTarget(project, token, claims), 302);

  const key = `${project.id}|${claims.tokenId}`;
  let score: number | null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) score = hit.score;
  else {
    const report = await getStoredReport(project.id, project.organizationId).catch(() => null);
    score = report?.crawl.crawlRunId ? report.overall.score : null;
    if (cache.size >= 500) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), score });
  }
  return svgResponse(renderBadgeSvg({ score, link }));
}
