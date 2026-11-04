// POST: look at one page of a problem again ("Check again" on a fix). Member+, rate limited.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { recheckTodo } from "@/lib/tasks/todo-server";

const schema = z.object({
  issueId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  url: z.string().url().max(2000).optional(),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, schema);
  if (!checkRateLimit(`todo-recheck:${s.userId}`, 20, 10 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many checks in a short time. Try again in a few minutes.");
  }
  return json({ item: await recheckTodo(s, project, body.issueId, body.url) });
});
