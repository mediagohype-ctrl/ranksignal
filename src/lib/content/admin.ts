// Blog post create / update / delete for /admin/content, with role rules:
// writers (content.write) edit drafts and send them for review; publishers (content.publish) publish, edit live
// posts, unpublish and delete. Publishing pings IndexNow (best effort) so Bing picks the post up within minutes.
import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { staffAudit } from "@/lib/admin/audit";
import type { StaffContext } from "@/lib/admin/guard";
import { indexNowKey, submitIndexNow } from "@/lib/seo/indexnow";
import { log } from "@/lib/log";
import { slugProblem, type PostInput, type postPatchSchema } from "./posts";
import type { z } from "zod";

type Patch = z.infer<typeof postPatchSchema>;

function uniqueSlugError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new HttpError(409, "slug_taken", "Another post already uses this address. Change the slug.", { fieldErrors: { slug: ["Already used"] } });
  }
  throw e;
}

async function pingIndexNow(slug: string) {
  if (!indexNowKey()) return;
  try {
    await submitIndexNow({ paths: [`/blog/${slug}`, "/blog", "/sitemap.xml"] });
  } catch (e) {
    log.warn("content.indexnow_failed", { slug, err: e instanceof Error ? e.message : String(e) });
  }
}

export async function createPost(staff: StaffContext, req: Request, input: PostInput) {
  const bad = slugProblem(input.slug);
  if (bad) throw new HttpError(400, "slug_reserved", bad, { fieldErrors: { slug: [bad] } });
  const post = await db.blogPost
    .create({
      data: {
        ...input,
        faqs: input.faqs as Prisma.InputJsonValue,
        metaTitle: input.metaTitle || null,
        coverImageUrl: input.coverImageUrl || null,
        authorId: staff.user.id,
        status: "draft",
      },
    })
    .catch(uniqueSlugError);
  await staffAudit(staff, req, { action: "content.post_created", resourceType: "blog_post", resourceId: post.id, after: { slug: post.slug, title: post.title } });
  return post;
}

export async function updatePost(staff: StaffContext, req: Request, id: string, patch: Patch) {
  const before = await db.blogPost.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "not_found", "Post not found");
  const { status, reason, ...fields } = patch;
  const canPublish = staff.can("content.publish");

  if (before.status === "published" && !canPublish) {
    throw new HttpError(403, "forbidden", "This post is live. Only a publisher (SEO or Marketing role) can edit it.");
  }
  if (status && (status === "published" || status === "archived" || before.status === "published") && !canPublish) {
    throw new HttpError(403, "forbidden", "Only a publisher can publish, unpublish or archive. Send it for review instead.");
  }
  if (fields.slug) {
    const bad = slugProblem(fields.slug);
    if (bad) throw new HttpError(400, "slug_reserved", bad, { fieldErrors: { slug: [bad] } });
  }

  const data: Prisma.BlogPostUpdateInput = {
    ...fields,
    ...(fields.faqs ? { faqs: fields.faqs as Prisma.InputJsonValue } : {}),
    ...(fields.metaTitle !== undefined ? { metaTitle: fields.metaTitle || null } : {}),
    ...(fields.coverImageUrl !== undefined ? { coverImageUrl: fields.coverImageUrl || null } : {}),
  };
  if (status) {
    data.status = status;
    if (status === "published" && !before.publishedAt) data.publishedAt = new Date();
  }
  const post = await db.blogPost.update({ where: { id }, data }).catch(uniqueSlugError);

  if (status && status !== before.status) {
    await staffAudit(staff, req, {
      action: `content.post_${status}`,
      resourceType: "blog_post",
      resourceId: id,
      before: { status: before.status },
      after: { status, slug: post.slug },
      reason,
    });
  }
  if (post.status === "published" && (status === "published" || before.status === "published")) await pingIndexNow(post.slug);
  return post;
}

export async function deletePost(staff: StaffContext, req: Request, id: string, reason?: string) {
  const before = await db.blogPost.findUnique({ where: { id }, select: { slug: true, title: true, status: true } });
  if (!before) throw new HttpError(404, "not_found", "Post not found");
  await db.blogPost.delete({ where: { id } });
  await staffAudit(staff, req, { action: "content.post_deleted", resourceType: "blog_post", resourceId: id, before, reason });
}
