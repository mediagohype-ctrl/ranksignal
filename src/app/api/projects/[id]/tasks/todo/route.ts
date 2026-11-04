// POST: record what someone did with a To-do item (done / skipped / not for me / put back). Member+.
// "done" on a website problem also looks at that page again and returns what we saw.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { changeTodo } from "@/lib/tasks/todo-server";

const schema = z.object({
  itemId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  state: z.enum(["done", "started", "skipped", "dismissed", "open"]),
  recheck: z.boolean().optional(),
  url: z.string().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL").optional(),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, schema);
  // "done" fetches a page from the customer's site; keep it to a human pace.
  if (body.state === "done" && body.recheck !== false && !checkRateLimit(`todo-done:${s.userId}`, 30, 10 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many checks in a short time. Try again in a few minutes.");
  }
  return json({ item: await changeTodo(s, project, body.itemId, body.state, { url: body.url, recheck: body.recheck }) });
});
