// /api/admin/content/[id] — GET one post; PATCH fields and/or status; DELETE (publishers only).
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { postPatchSchema } from "@/lib/content/posts";
import { deletePost, updatePost } from "@/lib/content/admin";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireStaffApi("content.view");
  const { id } = await params;
  const item = await db.blogPost.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, "not_found", "Post not found");
  return json({ item });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("content.write");
  const { id } = await params;
  return json({ item: await updatePost(staff, req, id, await parseBody(req, postPatchSchema)) });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("content.publish");
  const { id } = await params;
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().max(500).optional() }));
  await deletePost(staff, req, id, reason);
  return json({ item: { deleted: true } });
});
