// Shared plumbing for the /api/projects/[id]/competitors/* routes: input schemas and the paid-action wrapper
// (member+ role, tenant-scoped project, not-configured / rate-limit / allowance checks, friendly provider errors).
import { z } from "zod";
import { HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import type { DfsFeature } from "@/lib/dataforseo/client";
import { normaliseDomain } from "@/lib/dataforseo/locations";
import { paidCallError, paidGuard } from "./guard";
import { getCompetitorsView, marketOf, ownDomainOf, savedCompetitorDomains, type Actor, type Market } from "./service";

export type RouteCtx = { params: Promise<{ id: string }> };

export const marketSchema = z.object({
  locationId: z.string().max(40).optional(),
  language: z.string().max(5).optional(),
});

export const domainSchema = z
  .string()
  .max(300)
  .transform((v, ctx) => {
    const d = normaliseDomain(v);
    if (!d) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a website address like example.com" });
      return z.NEVER;
    }
    return d;
  });

/** De-duplicate a list of already-normalised domains, keeping order. */
export const uniq = (xs: string[]) => [...new Set(xs)];

export interface PaidContext {
  actor: Actor;
  market: Market;
  ownDomain: string | null;
  saved: string[];
}

/**
 * Run one paid action: member+ (viewers can only read), project scoped to the session's organization, body
 * validated, then not-configured (501) / rate limit (429) / allowance (402) checks, then the call itself.
 * Responds with `{ result, item }` where item is the refreshed page view.
 */
export async function paidAction<S extends z.ZodTypeAny, R>(
  req: Request,
  { params }: RouteCtx,
  schema: S,
  feature: DfsFeature,
  units: (body: z.infer<S>, c: PaidContext) => number | Promise<number>,
  run: (body: z.infer<S>, c: PaidContext) => Promise<R>,
): Promise<Response> {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const body = await parseBody(req, schema);
  const ownDomain = ownDomainOf(project.websiteUrl);
  const c: PaidContext = {
    actor: { organizationId: s.organizationId, projectId: project.id, userId: s.userId },
    market: marketOf((body as { locationId?: unknown }).locationId, (body as { language?: unknown }).language),
    ownDomain,
    saved: savedCompetitorDomains(project.competitors, ownDomain),
  };
  const n = await units(body, c);
  if (!Number.isFinite(n) || n < 1) throw new HttpError(400, "nothing_to_check", "Add at least one website to check.");
  const guard = await paidGuard(s, feature, n);
  if (guard instanceof Response) return guard;
  let result: R;
  try {
    result = await run(body, c);
  } catch (err) {
    paidCallError(err);
  }
  return json({ result, item: await getCompetitorsView(s.organizationId, project) });
}
