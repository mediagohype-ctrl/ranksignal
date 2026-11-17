// POST /api/projects/[id]/competitors/suggestions {locationId?, language?} — websites Google sees competing with yours
// that you haven't saved yet (DataForSEO Labs competitors_domain). member+; 1 "domain_compare" unit.
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { getAiCompetitorSuggestions } from "@/lib/competitors/ai-suggestions";
import { marketSchema, paidAction, type RouteCtx } from "@/lib/competitors/routes";
import { runSuggestions } from "@/lib/competitors/service";
import { UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

/**
 * GET — free suggestions: businesses AI already names or links in this website's latest real AI check that aren't
 * saved as competitors yet. viewer+; no paid data call. Add one with POST …/suggestions/add {domain, name}.
 */
export const GET = handler(async (_req: Request, { params }: RouteCtx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const item = await getAiCompetitorSuggestions(s.organizationId, project.id);
  return json({ item: item ?? { items: [], saved: 0, measuredAt: null } });
});

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(
    req,
    ctx,
    marketSchema,
    "domain_compare",
    (_b, c) => {
      if (!c.ownDomain) throw new HttpError(400, "no_website", "Add your website address in project settings first.");
      return UNITS.suggestions;
    },
    (_b, c) => runSuggestions(c.actor, c.ownDomain!, c.saved, c.market),
  ),
);
