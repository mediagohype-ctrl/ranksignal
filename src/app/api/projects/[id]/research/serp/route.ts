// SERP checker (DataForSEO SERP, Google organic). GET: allowance + recent checks (viewer+), or ?search=<id> to re-open a
// past check from the cache (free). POST {keyword, locationId, languageId, device}: one check (member+). The same check
// within 24 hours comes from the shared cache and doesn't use allowance. Tenant-scoped.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { DFS_LOCATIONS, normaliseKeyword } from "@/lib/dataforseo/locations";
import { AllowanceExhaustedError, openPastSearch, researchOverview, runSerpCheck } from "@/lib/research/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const LOCATION_IDS = DFS_LOCATIONS.map((l) => l.id) as [string, ...string[]];
const bodySchema = z.object({
  keyword: z.string().max(200),
  locationId: z.enum(LOCATION_IDS).default("in"),
  languageId: z.enum(["en", "hi"]).default("en"),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
});
const SEARCH_ID_RE = /^[a-z0-9]{10,40}$/i;

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const searchId = new URL(req.url).searchParams.get("search");
  if (searchId) {
    if (!SEARCH_ID_RE.test(searchId)) throw new HttpError(404, "not_found", "Search not found");
    return json(await openPastSearch(s.organizationId, project, "serp", searchId));
  }
  return json(await researchOverview(s.organizationId, project.id, "serp"));
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const input = await parseBody(req, bodySchema);
  const keyword = normaliseKeyword(input.keyword);
  if (!keyword || keyword.length < 2) throw new HttpError(400, "invalid_keyword", "Type the search you want to check (up to 80 characters).");
  try {
    return json(
      await runSerpCheck({ organizationId: s.organizationId, projectId: project.id, userId: s.userId }, project, { ...input, keyword }),
    );
  } catch (err) {
    if (err instanceof AllowanceExhaustedError) return json({ error: "allowance", message: err.message, allowance: err.status }, { status: 402 });
    throw err;
  }
});
