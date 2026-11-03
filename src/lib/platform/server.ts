// The platform a project's website is built with: from the stored website check, or (for checks made before
// detection existed) one quick SSRF-safe fetch of the home page, cached in memory. Server-only.
import { db } from "@/lib/db";
import { safeFetch } from "@/lib/crawler/safe-fetch";
import { log } from "@/lib/log";
import { detectPlatform, isPlatform, type Platform } from "./detect";

const CACHE_MS = 60 * 60 * 1000;
const cache = new Map<string, { platform: Platform | null; at: number }>();

export async function getSitePlatform(organizationId: string, projectId: string, websiteUrl: string, crawlRunId: string | null): Promise<Platform | null> {
  if (crawlRunId) {
    const pages = await db.crawlPage.findMany({
      where: { organizationId, crawlRunId, statusCode: 200 },
      select: { extracted: true },
      orderBy: { crawledAt: "asc" }, // home page first
      take: 5,
    });
    for (const p of pages) {
      const v = (p.extracted as { platform?: unknown } | null)?.platform;
      if (isPlatform(v)) return v;
    }
  }
  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.platform;
  let platform: Platform | null = null;
  try {
    const res = await safeFetch(websiteUrl, { timeoutMs: 6000, maxBytes: 2_000_000 });
    platform = detectPlatform(res.body, Object.fromEntries(res.headers.entries()));
  } catch (err) {
    log.warn("platform.detect_failed", { projectId, err });
  }
  cache.set(projectId, { platform, at: Date.now() });
  return platform;
}
