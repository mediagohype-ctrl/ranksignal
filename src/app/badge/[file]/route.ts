// GET /badge/<share token>.svg — public "AI-ready score 82" badge linking back to the shared report.
// Same access rule as /r/[token]: signed share token + the project's current share settings (enabled, same tokenId).
// The score is the stored overall score (getStoredReport — never an LLM call). Cached for an hour at the edge.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { isShareActive, verifyShareToken } from "@/lib/share/token";
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

export async function GET(req: Request, { params }: Ctx) {
  const { file } = await params;
  const home = BRAND.appUrl;
  const notFound = () => svgResponse(renderBadgeSvg({ score: null, label: "AI-ready score", link: home }), 404);
  if (!file.endsWith(".svg")) return notFound();
  if (!checkRateLimit(`badge:${clientIp(req)}`, 120, 60_000).allowed) return notFound();
  const token = decodeURIComponent(file.slice(0, -4));
  const claims = await verifyShareToken(token).catch(() => null);
  if (!claims) return notFound();
  const project = await db.project.findUnique({ where: { id: claims.projectId }, select: { id: true, organizationId: true, settings: true } });
  if (!project || !isShareActive(project.settings, claims)) return notFound();

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
  const link = new URL(`/r/${encodeURIComponent(token)}`, home).toString();
  return svgResponse(renderBadgeSvg({ score, link }));
}
