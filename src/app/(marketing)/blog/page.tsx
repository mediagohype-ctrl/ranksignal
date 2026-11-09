import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { publishedPosts } from "@/lib/content/posts";
import { ARTICLES } from "@/lib/learn/articles";
import { breadcrumbLd, siteUrl } from "@/lib/seo/schema";
import { JsonLd, PageHero } from "@/components/marketing/ui";

const TITLE = "Blog: SEO, AEO & GEO news, research and how-tos";
const DESCRIPTION =
  "The MyWebRank blog: practical SEO, answer engine optimization (AEO) and generative engine optimization (GEO) advice for getting found on Google and recommended by ChatGPT, Gemini and Perplexity.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog", types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `${BRAND.name} blog` }] } },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: "/blog", siteName: BRAND.name, type: "website" },
};

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function BlogIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const all = await publishedPosts();
  const categories = [...new Set(all.map((p) => p.category))].sort();
  // Unknown ?category= values are ignored (no empty, indexable filter pages).
  const asked = typeof sp.category === "string" ? sp.category.slice(0, 40) : undefined;
  const category = asked && categories.includes(asked) ? asked : undefined;
  const posts = category ? all.filter((p) => p.category === category) : all;
  const base = siteUrl();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": `${base}/blog#blog`,
            name: `${BRAND.name} blog`,
            description: DESCRIPTION,
            url: `${base}/blog`,
            publisher: { "@id": `${base}/#organization` },
            inLanguage: "en-IN",
            blogPost: posts.slice(0, 30).map((p) => ({
              "@type": "BlogPosting",
              "@id": `${base}/blog/${p.slug}#article`,
              headline: p.title,
              url: `${base}/blog/${p.slug}`,
              datePublished: p.publishedAt?.toISOString(),
              dateModified: p.updatedAt.toISOString(),
              author: { "@type": "Person", name: p.authorName },
            })),
          },
          breadcrumbLd([{ name: "Blog", path: "/blog" }], base),
        ]}
      />
      <PageHero
        eyebrow="Blog"
        title="SEO, AEO and GEO blog"
        intro={<p>Research, how-tos and news on getting found on Google and named by AI assistants — from the {BRAND.name} team.</p>}
      />
      <section className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-8">
          {categories.length > 1 && (
            <nav aria-label="Categories" className="flex flex-wrap gap-2">
              {[undefined, ...categories].map((c) => (
                <Link
                  key={c ?? "all"}
                  href={c ? `/blog?category=${encodeURIComponent(c)}` : "/blog"}
                  aria-current={c === category ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-small font-medium ${
                    c === category ? "border-fg bg-fg text-bg" : "border-border text-fg-soft hover:text-fg"
                  }`}
                >
                  {c ?? "All"}
                </Link>
              ))}
            </nav>
          )}

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8">
              <p className="text-fg">New posts are on the way. Meanwhile, read our in-depth guides:</p>
              <ul className="mt-4 space-y-2">
                {ARTICLES.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/learn/${a.slug}`} className="font-medium text-primary hover:underline">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-colors hover:border-border-strong"
                  >
                    {p.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImageUrl} alt="" loading="lazy" className="aspect-[1200/630] w-full object-cover" />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-caption font-semibold uppercase tracking-[0.06em] text-primary">{p.category}</p>
                      <h2 className="mt-2 text-h4 text-fg">{p.title}</h2>
                      <p className="mt-3 flex-1 text-small leading-relaxed text-fg-soft">{p.description}</p>
                      <p className="mt-5 flex items-center justify-between text-xs text-muted">
                        <span>
                          {p.authorName} · {p.publishedAt ? fmt(p.publishedAt) : ""}
                        </span>
                        <ArrowRight aria-hidden size={16} className="text-primary transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
