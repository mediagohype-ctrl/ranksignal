// Starred keywords (Keywords > Tracked). GET: list + plan usage (viewer+). POST {query}: star (member+, plan limit
// per organization). DELETE {query}: un-star (member+). Tenant-scoped.
import { z } from "zod";
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { addStar, cleanQuery, listStars, removeStar, starUsage } from "@/lib/keywords/data";
import { MAX_QUERY_LENGTH } from "@/lib/keywords/limits";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ query: z.string().trim().min(1).max(MAX_QUERY_LENGTH) });
type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const [items, usage] = await Promise.all([listStars(s.organizationId, project.id), starUsage(s.organizationId)]);
  return json({ items, usage });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { query } = await parseBody(req, bodySchema);
  const r = await addStar(s.organizationId, project.id, cleanQuery(query), s.userId);
  return json({ ok: true, ...r, usage: await starUsage(s.organizationId) }, { status: r.created ? 201 : 200 });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { query } = await parseBody(req, bodySchema);
  const r = await removeStar(s.organizationId, project.id, cleanQuery(query));
  return json({ ok: true, ...r, usage: await starUsage(s.organizationId) });
});
