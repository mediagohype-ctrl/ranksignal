// GET: list tasks (viewers see client-visible tasks only). POST: create a task (member+).
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { createTask, listTasks, taskCreateSchema, taskFilterSchema } from "@/lib/tasks";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;
  const filters = taskFilterSchema.parse({
    status: sp.get("status") || undefined,
    category: sp.get("category") || undefined,
    performedBy: sp.get("performedBy") || undefined,
    assignee: sp.get("assignee") || undefined,
    q: sp.get("q") || undefined,
  });
  return json({ items: await listTasks(s, project.id, filters) });
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, taskCreateSchema);
  return json({ item: await createTask(s, project.id, body) }, { status: 201 });
});
