// PATCH: edit / move an off-site item through the pipeline (member+). DELETE: remove it (member+).
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { deleteOffsite, offsiteUpdateSchema, updateOffsite } from "@/lib/offsite";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id, itemId } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, offsiteUpdateSchema);
  return json({ item: await updateOffsite(s, itemId, body, project.id) });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id, itemId } = await params;
  const project = await requireProject(s, id);
  await deleteOffsite(s, itemId, project.id);
  return json({ ok: true });
});
