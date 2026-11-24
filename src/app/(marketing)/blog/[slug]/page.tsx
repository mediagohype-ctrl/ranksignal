import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BlogPost } from "@prisma/client";
import { isMovedPost, publishedPost, publishedPosts } from "@/lib/content/posts";
import { BlogPostView, postMetadata } from "./post-view";

type Props = { params: Promise<{ slug: string }> };

// Pre-rendered (SEO fix brief P5): every published post is built at deploy time and served from cache; a post saved
// in the admin editor is refreshed at once (revalidatePath in the content API) and at most hourly otherwise. New
// slugs render on first visit and are cached from then on. Staff previews of drafts live at /blog/<slug>/preview.
export async function generateStaticParams() {
  return (await publishedPosts({ take: 5000, includeNoindex: true })).map((p) => ({ slug: p.slug }));
}

async function load(slug: string): Promise<BlogPost | null> {
  if (isMovedPost(slug)) return null;
  return publishedPost(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return {};
  return postMetadata(p, false);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  return <BlogPostView post={p} />;
}
