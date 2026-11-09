import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { publishedPosts } from "@/lib/content/posts";
import { ARTICLES, getArticle } from "@/lib/learn/articles";
import { breadcrumbLd, faqLdFromQa, siteUrl, webPageLd } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO, PAGE_UPDATED } from "@/lib/seo/pages";
import { JsonLd, PageHero } from "@/components/marketing/ui";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { PLANS } from "@/lib/billing/plans";

const DESCRIPTION = PAGE_SEO["/blog"].description;

export const metadata: Metadata = {
  ...staticPageMetadata("/blog"),
  alternates: { canonical: "/blog", types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `${BRAND.name} blog` }] } },
};

/** Latest of the post dates and the page's own YYYY-MM-DD date, as an ISO string. */
function newestDate(dates: Date[], fallback: string): string {
  const own = new Date(`${fallback}T00:00:00Z`);
  const newest = dates.reduce((d, x) => (x > d ? x : d), own);
  return newest === own ? fallback : newest.toISOString();
}

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
          webPageLd("/blog", {
            type: "CollectionPage",
            base,
            // The index changes whenever a post does: newest post date, else the page's own date.
            extra: { dateModified: newestDate(all.map((p) => p.updatedAt), PAGE_UPDATED["/blog"]), mainEntity: { "@id": `${base}/blog#blog` } },
          }),
          faqLdFromQa(BLOG_FAQ),
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
      <section aria-labelledby="blog-topics" className="border-y border-border bg-surface py-16 sm:py-20">
        <div className="container-marketing">
          <div className="max-w-3xl space-y-4 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
            <p className="eyebrow">What we write about</p>
            <h2 id="blog-topics" className="text-h2 text-fg">
              What does the {BRAND.name} blog cover?
            </h2>
            <p>
              The blog covers three connected skills: SEO (ranking in Google&apos;s normal results), AEO (being the answer
              Google, voice assistants and chatbots read out) and GEO (being named and cited by AI assistants like ChatGPT,
              Gemini and Perplexity). Posts are practical and written for small-business owners, not specialists.
            </p>
            <p>
              Research matters here because the field is young. A 2023 study,{" "}
              <SourceLink href="https://arxiv.org/abs/2311.09735">GEO: Generative Engine Optimization</SourceLink>, found that
              adding statistics, quotations and cited sources could raise a page&apos;s visibility in AI answers by up to 40%.
              We test ideas like that against what our own audits see: on the {PLANS.starter.name} plan a single website check
              reads up to {PLANS.starter.maxPagesPerCrawl.toLocaleString("en-IN")} pages, so patterns show up quickly.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TOPIC_HUBS.map((h) => (
              <li key={h.title} className="flex flex-col rounded-2xl border border-border bg-bg p-6">
                <h3 className="text-h4 text-fg">{h.title}</h3>
                <p className="mt-2 flex-1 text-small leading-relaxed text-muted">{h.body}</p>
                <ul className="mt-4 space-y-1.5 text-small">
                  {h.guides.map((slug) => {
                    const g = getArticle(slug);
                    return g ? (
                      <li key={slug}>
                        <Link href={`/learn/${slug}`} className="font-medium text-primary hover:underline">
                          {g.title}
                        </Link>
                      </li>
                    ) : null;
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <QaSection id="blog-faq" title="About the blog" items={BLOG_FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://schema.org/BlogPosting", label: "schema.org: BlogPosting", note: "how each post is described to search engines" },
          ]}
        />
      </QaSection>
    </>
  );
}

const TOPIC_HUBS: { title: string; body: string; guides: string[] }[] = [
  { title: "SEO basics", body: "Getting pages crawled, indexed and ranked on Google, and auditing what is holding them back.", guides: ["website-seo-audit-checklist"] },
  { title: "AEO: being the answer", body: "Question headings, short direct answers and FAQ markup that answer engines can lift.", guides: ["what-is-aeo", "seo-vs-aeo-vs-geo"] },
  { title: "GEO: AI assistants", body: "How ChatGPT, Gemini and Perplexity pick sources, and how to become one of them.", guides: ["what-is-geo", "how-to-get-mentioned-by-chatgpt", "llms-txt-guide"] },
  { title: "Choosing help", body: "What good SEO work looks like, what it costs and which promises to walk away from.", guides: ["how-to-choose-an-seo-company"] },
];

const BLOG_FAQ: Qa[] = [
  {
    q: "Who writes the MyWebRank blog?",
    a: (
      <>
        The {BRAND.name} team, the same people who build our website checks and run our done-for-you service. Every post
        shows the author and date. When we quote a number, it comes from our own product or from a named public source,
        such as Google&apos;s documentation or published research.
      </>
    ),
  },
  {
    q: "How often do you publish new posts?",
    a: (
      <>
        We publish when we have something useful to say rather than on a fixed schedule, and we update older posts and
        guides when search engines change. To get new posts as they appear, subscribe to the <a href="/blog/rss.xml">RSS feed</a>{" "}
        or check back here.
      </>
    ),
  },
  {
    q: "Where should I start if I am new to this?",
    a: (
      <>
        Start with <Link href="/learn/seo-vs-aeo-vs-geo">SEO vs AEO vs GEO</Link> for the big picture, then run the{" "}
        <Link href="/free-check">free website check</Link> to see where your own site stands. It needs no sign-up and lists
        your top fixes in plain words, so you know which guide to read next.
      </>
    ),
  },
];
