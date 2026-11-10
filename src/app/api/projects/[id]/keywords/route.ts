// GET /api/projects/[id]/keywords?days=28&search=&sort=clicks&dir=desc&page=1&pageSize=50[&starred=1][&format=csv]
// Every Search Console query the site appeared for (stored by the daily sync), vs the previous period of the same
// length. Viewer+; tenant-scoped. format=csv exports the whole filtered list.
import { z } from "zod";
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { SORT_KEYS, filterKeywords, listKeywords, sortKeywords } from "@/lib/keywords/analyze";
import { keywordsCsv } from "@/lib/keywords/csv";
import { gscKeywordStatus, keywordDataset, listStars, starUsage } from "@/lib/keywords/data";
import { parseRangeDays } from "@/lib/keywords/limits";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().max(200).optional(),
  sort: z.enum(SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;
  const days = parseRangeDays(sp.get("days"));
  const o = querySchema.parse({
    search: sp.get("search") || undefined,
    sort: sp.get("sort") || undefined,
    dir: sp.get("dir") || undefined,
    page: sp.get("page") || undefined,
    pageSize: sp.get("pageSize") || undefined,
  });
  const status = await gscKeywordStatus(s.organizationId, project.id);
  const [data, starred, stars] = await Promise.all([
    keywordDataset(s.organizationId, project.id, days, status.lastDataDate),
    listStars(s.organizationId, project.id),
    starUsage(s.organizationId),
  ]);
  const only = sp.get("starred") === "1" ? new Set(starred) : undefined;

  if (sp.get("format") === "csv") {
    const rows = sortKeywords(filterKeywords(data.stats, { search: o.search, only }), o.sort, o.dir);
    const host = new URL(project.websiteUrl).hostname.replace(/[^a-z0-9.-]/gi, "");
    return new Response(keywordsCsv(rows, data.periods), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="keywords-${host}-${data.periods.from}-to-${data.periods.to}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  return json({
    status,
    periods: data.periods,
    totals: data.totals,
    hasPreviousData: data.hasPreviousData,
    keywordCount: data.stats.length,
    list: listKeywords(data.stats, { ...o, only }),
    starred,
    stars,
  });
});
