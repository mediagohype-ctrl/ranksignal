import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);

export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const body = await parseBody(req, schema);
  const result = await db.notification.updateMany({
    where: {
      organizationId: s.organizationId,
      OR: [{ userId: null }, { userId: s.userId }],
      readAt: null,
      ...("ids" in body ? { id: { in: body.ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return json({ item: { updated: result.count } });
});
