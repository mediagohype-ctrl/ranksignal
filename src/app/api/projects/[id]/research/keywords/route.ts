// Keyword research (DataForSEO Labs). GET: allowance + recent searches (viewer+), or ?search=<id> to re-open a past
// search from the cache (free). POST {keyword, locationId, languageId, mode}: one lookup (member+). Same lookup within
// 30 days comes from the shared cache and doesn't use allowance. Tenant-scoped.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { DFS_LOCATIONS, normaliseKeyword } from "@/lib/dataforseo/locations";
import { AllowanceExhaustedError, openPastSearch, researchOverview, runKeywordLookup } from "@/lib/research/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const LOCATION_IDS = DFS_LOCATIONS.map((l) => l.id) as [string, ...string[]];
const bodySchema = z.object({
  keyword: z.string().max(200),
  locationId: z.enum(LOCATION_IDS).default("in"),
  languageId: z.enum(["en", "hi"]).default("en"),
  mode: z.enum(["suggestions", "ideas"]).default("suggestions"),
});
const SEARCH_ID_RE = /^[a-z0-9]{10,40}$/i;

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const searchId = new URL(req.url).searchParams.get("search");
  if (searchId) {
    if (!SEARCH_ID_RE.test(searchId)) throw new HttpError(404, "not_found", "Search not found");
    return json(await openPastSearch(s.organizationId, project, "keywords", searchId));
  }
  return json(await researchOverview(s.organizationId, project.id, "keywords"));
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const input = await parseBody(req, bodySchema);
  const seed = normaliseKeyword(input.keyword);
  if (!seed || seed.length < 2) throw new HttpError(400, "invalid_keyword", "Type a word or short phrase (up to 80 characters).");
  try {
    return json(
      await runKeywordLookup({ organizationId: s.organizationId, projectId: project.id, userId: s.userId }, { ...input, seed }),
    );
  } catch (err) {
    if (err instanceof AllowanceExhaustedError) return json({ error: "allowance", message: err.message, allowance: err.status }, { status: 402 });
    throw err;
  }
});
