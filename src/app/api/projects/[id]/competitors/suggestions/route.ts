// POST /api/projects/[id]/competitors/suggestions {locationId?, language?} — websites Google sees competing with yours
// that you haven't saved yet (DataForSEO Labs competitors_domain). member+; 1 "domain_compare" unit.
import { handler, HttpError } from "@/lib/api";
import { marketSchema, paidAction, type RouteCtx } from "@/lib/competitors/routes";
import { runSuggestions } from "@/lib/competitors/service";
import { UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

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
