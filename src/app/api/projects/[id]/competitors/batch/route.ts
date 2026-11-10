// POST /api/projects/[id]/competitors/batch {text, locationId?, language?} — estimated traffic for a pasted list of up
// to 200 domains (plan-dependent; DataForSEO Labs bulk_traffic_estimation, one call). member+;
// "domain_compare" units = 1 per 50 domains, rounded up (1–4).
import { z } from "zod";
import { handler, HttpError } from "@/lib/api";
import { marketSchema, paidAction, type RouteCtx } from "@/lib/competitors/routes";
import { orgPlanId } from "@/lib/competitors/guard";
import { runBatch } from "@/lib/competitors/service";
import { batchMaxDomains, batchUnits, parseDomainList } from "@/lib/competitors/shared";

export const dynamic = "force-dynamic";

const schema = marketSchema.extend({ text: z.string().max(40_000) });

export const POST = handler((req: Request, ctx: RouteCtx) =>
  paidAction(
    req,
    ctx,
    schema,
    "domain_compare",
    async (b, c) => {
      const { domains } = parseDomainList(b.text);
      if (domains.length === 0) throw new HttpError(400, "no_domains", "Paste at least one website address, one per line.");
      const max = batchMaxDomains(await orgPlanId(c.actor.organizationId));
      if (domains.length > max) {
        throw new HttpError(400, "too_many", `Your plan checks up to ${max} websites at a time. You pasted ${domains.length}.`);
      }
      return batchUnits(domains.length);
    },
    (b, c) => {
      const { domains, invalid } = parseDomainList(b.text);
      return runBatch(c.actor, domains, invalid, c.market);
    },
  ),
);
