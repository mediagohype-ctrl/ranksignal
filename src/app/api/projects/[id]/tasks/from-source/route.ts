// POST {findingId | actionId, overrides?}: create a task prefilled (title, category, priority, links) from a finding or action.
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { createTaskFromSource, fromSourceSchema } from "@/lib/tasks";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, fromSourceSchema);
  return json({ item: await createTaskFromSource(s, project.id, body) }, { status: 201 });
});
