import { z } from "zod";
import { handler, json, requireSession } from "@/lib/api";
import { completeManually } from "@/lib/actions/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  note: z.string().max(2000).optional(),
  url: z.string().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL").optional(),
});

/** Mark an action that can't be auto-applied as done by hand. Admin+ (staff support mode counts as admin). */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = schema.parse(raw ?? {});
  const { action, execution } = await completeManually(id, body, s);
  return json({ item: action, execution: { id: execution.id, connector: execution.connector, result: execution.result } });
});
