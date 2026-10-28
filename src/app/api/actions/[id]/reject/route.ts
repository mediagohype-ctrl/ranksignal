import { z } from "zod";
import { handler, json, requireSession } from "@/lib/api";
import { reject } from "@/lib/actions/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.string().max(2000).optional() });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = schema.parse(raw ?? {});
  const item = await reject(id, body.reason, s);
  return json({ item });
});
