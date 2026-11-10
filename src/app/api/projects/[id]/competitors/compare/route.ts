// POST /api/projects/[id]/competitors/compare {domains[2..5], locationId?, language?} — side-by-side estimated traffic,
// ranking keywords and traffic value (DataForSEO Labs bulk_traffic_estimation). member+; 1 "domain_compare" unit.
import { z } from "zod";
import { handler, HttpError } from "@/lib/api";
import { domainSchema, marketSchema, paidAction, uniq, type RouteCtx } from "@/lib/competitors/routes";
import { runCompare } from "@/lib/competitors/service";
import { MAX_COMPARE_DOMAINS, UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

const schema = marketSchema.extend({ domains: z.array(domainSchema).min(1).max(MAX_COMPARE_DOMAINS) });

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(
    req,
    ctx,
    schema,
    "domain_compare",
    (b) => {
      if (uniq(b.domains).length < 2) throw new HttpError(400, "need_two", "Pick at least two different websites to compare.");
      return UNITS.compare;
    },
    (b, c) => runCompare(c.actor, uniq(b.domains), c.market),
  ),
);
