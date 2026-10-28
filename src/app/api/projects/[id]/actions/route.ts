import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handler, json, requireProject, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  status: z.string().max(400).optional().transform((v) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : undefined)),
  riskClass: z.enum(["A", "B", "C", "D"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(64).optional(),
});

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const where: Prisma.ActionWhereInput = {
    organizationId: s.organizationId,
    projectId: project.id,
    ...(q.status ? { status: { in: q.status } } : {}),
    ...(q.riskClass ? { riskClass: q.riskClass } : {}),
  };
  const rows = await db.action.findMany({
    where,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : undefined });
});
