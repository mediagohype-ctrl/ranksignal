// /api/admin/content — GET list of posts (content.view); POST create a draft (content.write).
import { handler, json, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { postInputSchema } from "@/lib/content/posts";
import { createPost } from "@/lib/content/admin";

export const GET = handler(async () => {
  await requireStaffApi("content.view");
  const items = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: { id: true, slug: true, title: true, status: true, category: true, authorName: true, publishedAt: true, updatedAt: true },
  });
  return json({ items });
});

export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi("content.write");
  const input = await parseBody(req, postInputSchema);
  return json({ item: await createPost(staff, req, input) });
});
