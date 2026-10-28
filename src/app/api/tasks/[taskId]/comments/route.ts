// GET: comments (internal notes only for admins / staff). POST: add a comment (member+; internal needs admin or staff).
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { addComment, commentCreateSchema, listComments } from "@/lib/tasks";

type Ctx = { params: Promise<{ taskId: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { taskId } = await params;
  return json({ items: await listComments(s, taskId) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { taskId } = await params;
  const body = await parseBody(req, commentCreateSchema);
  return json({ item: await addComment(s, taskId, body) }, { status: 201 });
});
