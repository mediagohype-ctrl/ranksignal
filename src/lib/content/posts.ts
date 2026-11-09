// Blog post data access + validation (server only).
import { z } from "zod";
import { db } from "@/lib/db";
import type { BlogPost } from "@prisma/client";

export const POST_STATUSES = ["draft", "review", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

const faqSchema = z.object({ q: z.string().trim().max(300), a: z.string().trim().max(2000) });

export const postInputSchema = z.object({
  title: z.string().trim().min(5).max(160),
  metaTitle: z.string().trim().max(120).nullable().optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only."),
  description: z.string().trim().min(20).max(320),
  answer: z.string().trim().max(1200).default(""),
  body: z.string().max(200_000).default(""),
  keyPoints: z.array(z.string().trim().max(300)).max(12).default([]),
  faqs: z.array(faqSchema).max(20).default([]),
  keywords: z.array(z.string().trim().min(1).max(100)).max(15).default([]),
  category: z.string().trim().min(2).max(40).default("SEO"),
  coverImageUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://"), "Use an https image address.")
    .nullable()
    .optional(),
  authorName: z.string().trim().min(2).max(120),
  noindex: z.boolean().default(false),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const postPatchSchema = postInputSchema.partial().extend({
  status: z.enum(POST_STATUSES).optional(),
  reason: z.string().trim().max(500).optional(),
});

/** Slugs that would collide with existing marketing routes under /blog are fine; reserved words are not. */
const RESERVED = new Set(["rss", "rss-xml", "feed", "category", "page", "new", "admin"]);
export function slugProblem(slug: string): string | null {
  return RESERVED.has(slug) ? "This address is reserved. Pick another." : null;
}

export function faqsOf(p: Pick<BlogPost, "faqs">): { q: string; a: string }[] {
  const raw = Array.isArray(p.faqs) ? (p.faqs as unknown[]) : [];
  return raw
    .map((f) => (f && typeof f === "object" ? (f as { q?: unknown; a?: unknown }) : {}))
    .filter((f): f is { q: string; a: string } => typeof f.q === "string" && typeof f.a === "string" && !!f.q.trim() && !!f.a.trim());
}

/** Published, indexable posts (newest first). Never throws: the public site must render without the DB. */
export async function publishedPosts(opts: { take?: number; category?: string; includeNoindex?: boolean } = {}) {
  try {
    return await db.blogPost.findMany({
      where: {
        status: "published",
        publishedAt: { lte: new Date() },
        ...(opts.includeNoindex ? {} : { noindex: false }),
        ...(opts.category ? { category: opts.category } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: opts.take ?? 200,
    });
  } catch {
    return [];
  }
}

/** Markdown export of a post for llms-full.txt (relative links made absolute). */
export function postToMarkdown(p: BlogPost, base: string): string {
  const abs = (s: string) => s.replace(/\]\((\/[^)]*)\)/g, (_, path: string) => `](${base}${path})`);
  const out = [`# ${p.title}`, "", `URL: ${base}/blog/${p.slug}`, `Updated: ${p.updatedAt.toISOString().slice(0, 10)}`, `Author: ${p.authorName}`, ""];
  if (p.answer) out.push(`> ${p.answer}`, "");
  if (p.keyPoints.length) out.push("Key points:", "", ...p.keyPoints.map((k) => `- ${k}`), "");
  out.push(abs(p.body), "");
  const faqs = faqsOf(p);
  if (faqs.length) {
    out.push("## FAQ", "");
    for (const f of faqs) out.push(`### ${f.q}`, "", f.a, "");
  }
  return out.join("\n");
}

/**
 * One published post, or null when it truly doesn't exist. Database errors are NOT swallowed: the page then
 * answers 500 (crawlers retry) instead of 404 (crawlers may drop a live post from the index).
 */
export async function publishedPost(slug: string) {
  return db.blogPost.findFirst({ where: { slug, status: "published", publishedAt: { lte: new Date() } } });
}
