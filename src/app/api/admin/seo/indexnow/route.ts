// POST /api/admin/seo/indexnow {paths?: string[], reason} — submit our public URLs to IndexNow (Bing & co).
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";
import { submitIndexNow } from "@/lib/seo/indexnow";
import { publishedPosts } from "@/lib/content/posts";

const schema = z.object({
  paths: z.array(z.string().regex(/^\/[^\s]*$/).max(512)).max(500).optional(),
  reason: reasonSchema.optional().default("IndexNow submission"),
});

export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi("seo.manage");
  const { paths, reason } = await parseBody(req, schema);
  let result;
  try {
    const posts = paths?.length ? [] : await publishedPosts();
    result = await submitIndexNow({ paths, extraPaths: posts.map((p) => `/blog/${p.slug}`) });
  } catch (e) {
    throw new HttpError(400, "indexnow_not_configured", e instanceof Error ? e.message : "IndexNow is not configured.");
  }
  await staffAudit(staff, req, {
    action: "admin.seo_indexnow_submitted",
    resourceType: "site",
    resourceId: "marketing",
    after: { status: result.status, submitted: result.submitted },
    reason,
  });
  if (!result.ok) throw new HttpError(502, "indexnow_rejected", result.message);
  return json({ item: result });
});
