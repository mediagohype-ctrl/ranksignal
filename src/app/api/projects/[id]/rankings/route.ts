// Rank tracker. GET: tracked keywords with current positions (viewer+); ?format=csv exports them; ?keywordId=… returns
// one keyword's position history. POST {keywords[], locationId?, device?, language?}: start tracking (member+, plan
// limit per project) → { added, skipped, limit }. DELETE {ids[]}: stop tracking and drop history (member+).
// Tenant-scoped. No paid call happens here: checks run in the "rank_tracker" job.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import { languageCode } from "@/lib/dataforseo/locations";
import { MAX_KEYWORDS_PER_REQUEST } from "@/lib/rank-tracker/limits";
import { cleanDevice, cleanKeywordList, cleanLocationId, rankingsCsv } from "@/lib/rank-tracker/logic";
import { addTrackedKeywords, csvRows, getRankTrackerView, keywordHistory, removeTrackedKeywords } from "@/lib/rank-tracker/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const addSchema = z.object({
  keywords: z.array(z.string().max(300)).min(1).max(MAX_KEYWORDS_PER_REQUEST * 2),
  locationId: z.string().max(40).optional(),
  device: z.enum(["mobile", "desktop"]).optional(),
  language: z.enum(["en", "hi"]).optional(),
});
const removeSchema = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(2000) });

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;

  const keywordId = sp.get("keywordId");
  if (keywordId) {
    if (keywordId.length > 40) throw new HttpError(400, "invalid_id", "Invalid keyword id");
    return json(await keywordHistory(s.organizationId, project.id, keywordId));
  }

  const view = await getRankTrackerView(s.organizationId, project.id, project.websiteUrl);
  if (sp.get("format") === "csv") {
    const host = (view.domain ?? "site").replace(/[^a-z0-9.-]/gi, "");
    return new Response(rankingsCsv(csvRows(view)), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="rankings-${host}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  return json({ item: view });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const body = await parseBody(req, addSchema);
  const { keywords, invalid, overflow } = cleanKeywordList(body.keywords, MAX_KEYWORDS_PER_REQUEST);
  if (keywords.length === 0) {
    throw new HttpError(400, "no_keywords", "Add at least one keyword (up to 80 characters each).");
  }
  const r = await addTrackedKeywords({
    organizationId: s.organizationId,
    projectId: project.id,
    userId: s.userId,
    keywords,
    locationId: cleanLocationId(body.locationId),
    device: cleanDevice(body.device),
    language: languageCode(body.language),
  });
  if (r.added > 0) {
    await writeAuditLog({
      organizationId: s.organizationId,
      ...auditActorFromSession(s),
      action: "rank_tracker.keywords_added",
      resourceType: "project",
      resourceId: project.id,
      after: { added: r.added, locationId: cleanLocationId(body.locationId), device: cleanDevice(body.device) },
    });
  }
  return json({ ...r, skipped: r.skipped + invalid + overflow, invalid, overflow }, { status: r.added > 0 ? 201 : 200 });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { ids } = await parseBody(req, removeSchema);
  const removed = await removeTrackedKeywords(s.organizationId, project.id, ids);
  if (removed > 0) {
    await writeAuditLog({
      organizationId: s.organizationId,
      ...auditActorFromSession(s),
      action: "rank_tracker.keywords_removed",
      resourceType: "project",
      resourceId: project.id,
      after: { removed },
    });
  }
  return json({ ok: true, removed });
});
