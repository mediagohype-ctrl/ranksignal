// Hindi guides (/hi/learn/<slug>): same layout as the English guides, <html lang="hi"> from the Hindi root layout,
// hreflang to the English guide where one is paired (src/components/marketing/hi/pairs.ts). Pre-rendered at build.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HINDI_ARTICLES, getHindiArticle } from "@/lib/learn/hi";
import { DEFAULT_AUTHOR } from "@/lib/authors";
import { fitDescription, pageMetadata } from "@/lib/seo/metadata";
import { hreflangFor } from "@/components/marketing/hi/pairs";
import { ArticleView } from "@/components/marketing/article-view";

export const dynamicParams = false;
export function generateStaticParams() {
  return HINDI_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getHindiArticle(slug);
  if (!a) return {};
  const path = `/hi/learn/${a.slug}`;
  return {
    ...pageMetadata({
      title: a.metaTitle,
      description: fitDescription(a.description),
      path,
      type: "article",
      publishedTime: a.published,
      modifiedTime: a.updated,
      authors: [DEFAULT_AUTHOR.name],
      keywords: a.keywords,
      locale: "hi_IN",
      languages: hreflangFor(path),
    }),
    authors: [{ name: DEFAULT_AUTHOR.name, url: `/author/${DEFAULT_AUTHOR.slug}` }],
  };
}

export default async function HindiArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getHindiArticle(slug);
  if (!a) notFound();
  return <ArticleView a={a} lang="hi" related={a.related.map(getHindiArticle).filter((r) => r !== undefined)} />;
}
