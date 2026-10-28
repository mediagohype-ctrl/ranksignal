// GET: task + status history. PATCH: edit (member+). DELETE: admin or staff support mode.
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { deleteTask, getTask, getTaskHistory, taskPatchSchema, updateTask } from "@/lib/tasks";

type Ctx = { params: Promise<{ taskId: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { taskId } = await params;
  const [item, history] = await Promise.all([getTask(s, taskId), getTaskHistory(s, taskId)]);
  return json({ item, history });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { taskId } = await params;
  const body = await parseBody(req, taskPatchSchema);
  return json({ item: await updateTask(s, taskId, body) });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { taskId } = await params;
  await deleteTask(s, taskId);
  return json({ ok: true });
});
