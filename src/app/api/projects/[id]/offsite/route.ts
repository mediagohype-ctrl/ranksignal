// GET: list off-site items (viewer+). POST: add one (member+).
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { createOffsite, listOffsite, offsiteCreateSchema, offsiteFilterSchema } from "@/lib/offsite";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;
  const filters = offsiteFilterSchema.parse({
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    q: sp.get("q") || undefined,
  });
  return json({ items: await listOffsite(s, project.id, filters) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, offsiteCreateSchema);
  return json({ item: await createOffsite(s, project.id, body) }, { status: 201 });
});
