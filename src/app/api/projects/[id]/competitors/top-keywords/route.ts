// POST /api/projects/[id]/competitors/top-keywords {domain, locationId?, language?} — a domain's top 100 keywords by
// estimated visits and its top pages (DataForSEO Labs ranked_keywords). member+; 1 "competitor_traffic" unit.
import { z } from "zod";
import { handler } from "@/lib/api";
import { domainSchema, marketSchema, paidAction, type RouteCtx } from "@/lib/competitors/routes";
import { runTopKeywords } from "@/lib/competitors/service";
import { UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

const schema = marketSchema.extend({ domain: domainSchema });

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(req, ctx, schema, "competitor_traffic", () => UNITS.topKeywords, (b: z.infer<typeof schema>, c) => runTopKeywords(c.actor, b.domain, c.market)),
);
