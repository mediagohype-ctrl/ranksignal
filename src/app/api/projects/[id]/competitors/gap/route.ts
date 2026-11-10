// POST /api/projects/[id]/competitors/gap {competitor, locationId?, language?} — keywords the competitor ranks for in
// the top 20 that you don't (or rank below 20), by search volume (DataForSEO Labs domain_intersection, two calls).
// member+; 2 "keyword_gap" units.
import { handler, HttpError } from "@/lib/api";
import { domainSchema, marketSchema, paidAction, type RouteCtx } from "@/lib/competitors/routes";
import { runKeywordGap } from "@/lib/competitors/service";
import { UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

const schema = marketSchema.extend({ competitor: domainSchema });

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(
    req,
    ctx,
    schema,
    "keyword_gap",
    (b, c) => {
      if (!c.ownDomain) throw new HttpError(400, "no_website", "Add your website address in project settings first.");
      if (b.competitor === c.ownDomain) throw new HttpError(400, "same_domain", "Pick a competitor's website, not your own.");
      return UNITS.gap;
    },
    (b, c) => runKeywordGap(c.actor, b.competitor, c.ownDomain!, c.market),
  ),
);
