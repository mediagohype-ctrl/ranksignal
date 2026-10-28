import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { approve } from "@/lib/actions/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ draftHash: z.string().regex(/^[a-f0-9]{64}$/), comments: z.string().max(2000).optional() });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const body = await parseBody(req, schema);
  const { action, approval } = await approve(id, body, s);
  return json({ item: { action, approval } });
});
