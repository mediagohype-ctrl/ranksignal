import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/lib/learn/articles";
import { DEFAULT_AUTHOR } from "@/lib/authors";
import { fitDescription, pageMetadata } from "@/lib/seo/metadata";
import { hreflangFor } from "@/components/marketing/hi/pairs";
import { ArticleView } from "@/components/marketing/article-view";

// Pre-rendered at build time (one HTML file per guide, refreshed at most hourly by the layout's revalidate), so
// guides load as fast as the tool pages (SEO fix brief P5). Unknown slugs are a plain 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return {};
  return {
    // pageMetadata keeps the full <title> within 60 characters (drops the brand suffix or shortens when needed).
    ...pageMetadata({
      title: a.metaTitle,
      description: fitDescription(a.description),
      path: `/learn/${a.slug}`,
      type: "article",
      publishedTime: a.published,
      modifiedTime: a.updated,
      authors: [DEFAULT_AUTHOR.name],
      keywords: a.keywords,
      languages: hreflangFor(`/learn/${a.slug}`),
    }),
    authors: [{ name: DEFAULT_AUTHOR.name, url: `/author/${DEFAULT_AUTHOR.slug}` }],
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  return <ArticleView a={a} related={a.related.map(getArticle).filter((r) => r !== undefined)} />;
}
