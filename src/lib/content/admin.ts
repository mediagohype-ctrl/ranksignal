// Blog post create / update / delete for /admin/content, with role rules:
// writers (content.write) edit drafts and send them for review; publishers (content.publish) publish, edit live
// posts, unpublish, archive/restore and delete. Publishing/unpublishing tells IndexNow (Bing & co) in the
// background, so saves stay fast.
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { staffAudit } from "@/lib/admin/audit";
import type { StaffContext } from "@/lib/admin/guard";
import { indexNowKey, submitIndexNow } from "@/lib/seo/indexnow";
import { log } from "@/lib/log";
import { faqsOf, slugProblem, type PostInput, type postPatchSchema } from "./posts";
import { scorePost } from "./score";

type Patch = z.infer<typeof postPatchSchema>;

/** Minimum content score (out of 100) a post needs to go live — the editor shows the same rule. */
export const PUBLISH_MIN_SCORE = 50;

function mapPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      throw new HttpError(409, "slug_taken", "Another post already uses this address. Change the slug.", { fieldErrors: { slug: ["Already used"] } });
    }
    if (e.code === "P2025") throw new HttpError(404, "not_found", "Post not found (it may have just been deleted).");
  }
  throw e;
}

/** Fire-and-forget IndexNow ping (never blocks or fails a save). */
function pingIndexNow(paths: string[]) {
  if (!indexNowKey()) return;
  void submitIndexNow({ paths: [...paths, "/blog", "/sitemap.xml"] }).catch((e) =>
    log.warn("content.indexnow_failed", { paths, err: e instanceof Error ? e.message : String(e) }),
  );
}

function publishProblem(p: { title: string; metaTitle: string | null; description: string; slug: string; answer: string; body: string; keyPoints: string[]; faqs: unknown; keywords: string[]; authorName: string }): string | null {
  if (!p.body.trim()) return "The article is empty.";
  const score = scorePost({ ...p, faqs: faqsOf({ faqs: p.faqs as Prisma.JsonValue }) }).overall;
  return score < PUBLISH_MIN_SCORE ? `Content score is ${score}/100 — reach ${PUBLISH_MIN_SCORE} to publish.` : null;
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
    .catch(mapPrismaError);
  await staffAudit(staff, req, { action: "content.post_created", resourceType: "blog_post", resourceId: post.id, after: { slug: post.slug, title: post.title } });
  return post;
}

export async function updatePost(staff: StaffContext, req: Request, id: string, patch: Patch) {
  const before = await db.blogPost.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "not_found", "Post not found");
  const { status, reason, ...fields } = patch;
  const canPublish = staff.can("content.publish");
  const wasLive = before.status === "published";

  if (!canPublish) {
    if (wasLive) throw new HttpError(403, "forbidden", "This post is live. Only a publisher (SEO or Marketing role) can edit it.");
    if (before.status === "archived") throw new HttpError(403, "forbidden", "This post is archived. Only a publisher can restore it.");
    if (status === "published" || status === "archived") {
      throw new HttpError(403, "forbidden", "Only a publisher can publish or archive. Send it for review instead.");
    }
  }
  if (fields.slug !== undefined && fields.slug !== before.slug) {
    if (before.publishedAt) {
      throw new HttpError(409, "slug_locked", "This post has been published, so its address is fixed — changing it would break links and Google results.", {
        fieldErrors: { slug: ["Locked after publishing"] },
      });
    }
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
  if (status === "published") {
    const merged = { ...before, ...fields, metaTitle: fields.metaTitle !== undefined ? fields.metaTitle || null : before.metaTitle };
    const problem = publishProblem(merged);
    if (problem) throw new HttpError(400, "not_ready", problem);
  }

  let post;
  if (canPublish) {
    post = await db.blogPost.update({ where: { id }, data }).catch(mapPrismaError);
  } else {
    // Writers: only touch the post if it is still not live/archived (a publisher may have just published it).
    const r = await db.blogPost
      .updateMany({ where: { id, status: { notIn: ["published", "archived"] } }, data: data as Prisma.BlogPostUpdateManyMutationInput })
      .catch(mapPrismaError);
    if (r.count === 0) throw new HttpError(409, "post_changed", "This post was just published or archived by someone else. Reload to see it.");
    post = await db.blogPost.findUniqueOrThrow({ where: { id } }).catch(mapPrismaError);
  }

  const statusChanged = !!status && status !== before.status;
  if (statusChanged || wasLive) {
    // Status changes, and any edit to a live post, are audit-logged (who changed live content, and when).
    await staffAudit(staff, req, {
      action: statusChanged ? `content.post_${status}` : "content.live_post_edited",
      resourceType: "blog_post",
      resourceId: id,
      before: { status: before.status, ...(statusChanged ? {} : { fields: Object.keys(fields) }) },
      after: { status: post.status, slug: post.slug },
      reason,
    });
  }

  const nowLive = post.status === "published";
  if (nowLive && !post.noindex && (statusChanged || wasLive)) pingIndexNow([`/blog/${post.slug}`]);
  else if (wasLive && !nowLive) pingIndexNow([`/blog/${before.slug}`]); // tell search engines it's gone
  return post;
}

export async function deletePost(staff: StaffContext, req: Request, id: string, reason?: string) {
  const before = await db.blogPost.findUnique({ where: { id }, select: { slug: true, title: true, status: true } });
  if (!before) throw new HttpError(404, "not_found", "Post not found");
  await db.blogPost.delete({ where: { id } }).catch(mapPrismaError);
  await staffAudit(staff, req, { action: "content.post_deleted", resourceType: "blog_post", resourceId: id, before, reason });
  if (before.status === "published") pingIndexNow([`/blog/${before.slug}`]);
}
