// Staff preview of any post, including drafts (/blog/<slug>/preview, opened from the admin editor). Rendered per
// request, never cached and never indexed; everyone without content.view gets a 404. The public, pre-rendered page
// is /blog/<slug>.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadStaff } from "@/lib/admin/guard";
import { BlogPostView, postMetadata } from "../post-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const staff = await loadStaff().catch(() => null);
  if (!staff?.can("content.view")) return null;
  return db.blogPost.findUnique({ where: { slug } }).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? postMetadata(p, true) : { robots: { index: false, follow: false } };
}

export default async function BlogPostPreviewPage({ params }: Props) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return <BlogPostView post={p} isPreview={p.status !== "published"} />;
}
