// POST /api/projects/[id]/competitors/traffic {domains[1..5], locationId?, language?} — estimated Google traffic and
// ranking keywords per domain (DataForSEO Labs domain_rank_overview). member+; 1 "competitor_traffic" unit per domain.
import { z } from "zod";
import { handler } from "@/lib/api";
import { domainSchema, marketSchema, paidAction, uniq, type RouteCtx } from "@/lib/competitors/routes";
import { runTrafficCheck } from "@/lib/competitors/service";
import { MAX_TRAFFIC_DOMAINS, UNITS } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

const schema = marketSchema.extend({ domains: z.array(domainSchema).min(1).max(MAX_TRAFFIC_DOMAINS) });

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(
    req,
    ctx,
    schema,
    "competitor_traffic",
    (b) => uniq(b.domains).length * UNITS.trafficPerDomain,
    (b, c) => runTrafficCheck(c.actor, uniq(b.domains), c.market),
  ),
);
