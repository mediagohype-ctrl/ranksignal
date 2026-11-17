// Loads what the fix guides need to fill in ready code with real details: stored pages of one website check plus the
// project's confirmed facts. Server-only, tenant-scoped. Never throws (a guide without details still works).
import { db } from "@/lib/db";
import type { Platform } from "@/lib/platform/detect";
import type { ExtractedPage } from "@/lib/types";
import { isConsolidated } from "@/lib/report/inputs";
import { buildFixSite, type FixSite } from "./site";

export interface FixSiteData {
  site: FixSite;
  /** Main pages for the AI guide file (indexable HTML pages, home first). */
  sitePages: { url: string; title: string | null; description: string | null }[];
}

export async function loadFixSite(
  organizationId: string,
  project: { websiteUrl: string; name: string; brandNames: unknown; facts?: unknown },
  crawlRunId: string | null | undefined,
  platform?: Platform | null,
): Promise<FixSiteData> {
  const brand = (Array.isArray(project.brandNames) ? project.brandNames : []).find((b): b is string => typeof b === "string" && !!b.trim()) ?? project.name;
  let rows: { url: string; finalUrl: string | null; statusCode: number | null; contentType: string | null; extracted: unknown }[] = [];
  if (crawlRunId) {
    rows = await db.crawlPage
      .findMany({
        where: { organizationId, crawlRunId, statusCode: 200 },
        select: { url: true, finalUrl: true, statusCode: true, contentType: true, extracted: true },
        orderBy: { crawledAt: "asc" },
        take: 60,
      })
      .catch(() => []);
  }
  const pages = rows
    .filter((r) => r.extracted)
    .map((r) => ({ url: r.finalUrl ?? r.url, extracted: r.extracted as ExtractedPage }));
  const site = buildFixSite({ websiteUrl: project.websiteUrl, name: brand, facts: project.facts, pages, platform });
  const sitePages = rows
    .filter((r) => r.extracted && !isConsolidated({ url: r.url, finalUrl: r.finalUrl ?? r.url, statusCode: r.statusCode, redirectChain: [], contentType: r.contentType, extracted: r.extracted as ExtractedPage }))
    .map((r) => {
      const x = r.extracted as ExtractedPage;
      return { url: r.finalUrl ?? r.url, title: x.title ?? null, description: x.description ?? null };
    })
    .slice(0, 20);
  return { site, sitePages };
}
