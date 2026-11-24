// The blog post page body and metadata, shared by /blog/[slug] (pre-rendered) and /blog/[slug]/preview (staff).
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BlogPost } from "@prisma/client";
import { BRAND } from "@/lib/brand";
import { faqsOf, publishedPosts } from "@/lib/content/posts";
import { ARTICLES } from "@/lib/learn/articles";
import { AUTHORS, DEFAULT_AUTHOR } from "@/lib/authors";
import { AuthorBox, Byline, RelatedBlock, isGenericAuthor, personLd } from "@/components/marketing/article-parts";
import { parseMarkdown, plainText, wordCount } from "@/lib/content/markdown";
import { breadcrumbLd, faqLd, siteUrl } from "@/lib/seo/schema";
import { fitDescription, pageMetadata } from "@/lib/seo/metadata";
import { FinalCta, JsonLd, PageHero, Prose, inkPill } from "@/components/marketing/ui";
import { Markdown } from "@/components/marketing/markdown";

/** Metadata for a post page (also used by the staff preview, which is always noindex). */
export function postMetadata(p: BlogPost, isPreview: boolean): Metadata {
  const path = `/blog/${p.slug}`;
  return {
    // pageMetadata keeps the full <title> within 60 characters and falls back to /opengraph-image without a cover.
    ...pageMetadata({
      title: p.metaTitle || p.title,
      description: fitDescription(p.description),
      path,
      type: "article",
      publishedTime: p.publishedAt?.toISOString(),
      modifiedTime: p.updatedAt.toISOString(),
      authors: [p.authorName],
      keywords: p.keywords,
      ...(p.coverImageUrl ? { images: [{ url: p.coverImageUrl, width: 1200, height: 630, alt: p.title }] } : {}),
      ...(isPreview || p.noindex ? { robots: { index: false, follow: false } } : {}),
    }),
    alternates: { canonical: path, types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `${BRAND.name} blog` }] } },
    authors: [{ name: p.authorName }],
  };
}

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** One blog post. `isPreview` = a staff preview of an unpublished post (no JSON-LD, warning bar). */
export async function BlogPostView({ post: p, isPreview = false }: { post: BlogPost; isPreview?: boolean }) {
  // Company-style bylines ("MyWebRank team") are credited to the default author; a named staff author keeps their name.
  const known = isGenericAuthor(p.authorName) ? DEFAULT_AUTHOR : (Object.values(AUTHORS).find((a) => a.name === p.authorName) ?? null);
  const base = siteUrl();
  const url = `${base}/blog/${p.slug}`;
  const blocks = parseMarkdown(p.body);
  const toc = blocks.filter((b) => b.t === "h2");
  const faqs = faqsOf(p);
  const words = wordCount(plainText(blocks));
  const related = (await publishedPosts({ take: 12 })).filter((x) => x.slug !== p.slug && (x.category === p.category || x.keywords.some((k) => p.keywords.includes(k)))).slice(0, 3);

  const postLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: p.title,
    description: p.description,
    ...(p.answer ? { abstract: p.answer } : {}),
    keywords: p.keywords.join(", "),
    articleSection: p.category,
    wordCount: words,
    datePublished: (p.publishedAt ?? p.createdAt).toISOString(),
    dateModified: p.updatedAt.toISOString(),
    inLanguage: "en-IN",
    url,
    mainEntityOfPage: url,
    image: p.coverImageUrl ?? `${base}/opengraph-image`,
    author: known ? personLd(known, base) : { "@type": "Person", name: p.authorName, worksFor: { "@id": `${base}/#organization` } },
    publisher: { "@id": `${base}/#organization` },
    isPartOf: { "@id": `${base}/blog#blog` },
  };
  // Speakable only points at blocks that actually render on this post.
  const speakable = [p.answer ? "#answer" : null, p.keyPoints.length ? "#key-points" : null].filter((s): s is string => !!s);
  if (speakable.length) Object.assign(postLd, { speakable: { "@type": "SpeakableSpecification", cssSelector: speakable } });

  return (
    <>
      {!isPreview && (
        <JsonLd
          data={[
            postLd,
            ...(faqs.length ? [faqLd(faqs)] : []),
            breadcrumbLd([{ name: "Blog", path: "/blog" }, { name: p.title, path: `/blog/${p.slug}` }], base),
          ]}
        />
      )}
      {isPreview && (
        <div className="bg-warning-soft px-4 py-2 text-center text-small text-fg">
          Preview of a <strong>{p.status}</strong> post — only staff can see this, and it is hidden from Google.
        </div>
      )}
      <PageHero
        eyebrow={p.category}
        title={p.title}
        intro={
          known ? (
            <Byline author={known} updated={p.updatedAt} extra={`${Math.max(1, Math.round(words / 220))} min read`} />
          ) : (
            <p>
              By {p.authorName} · Updated <time dateTime={p.updatedAt.toISOString()}>{fmt(p.updatedAt)}</time> ·{" "}
              {Math.max(1, Math.round(words / 220))} min read
            </p>
          )
        }
      />
      <nav aria-label="Breadcrumb" className="container-marketing pt-6 text-small text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-fg">Home</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/blog" className="hover:text-fg">Blog</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-fg-soft">{p.title}</li>
        </ol>
      </nav>
      <div className="bg-bg py-10 sm:py-14">
        <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px] lg:gap-14">
          <article className="min-w-0">
            {p.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverImageUrl} alt={p.title} className="mb-8 w-full rounded-2xl border border-border" />
            )}
            <Prose>
              {p.answer && (
                <div id="answer" className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-6 text-fg">
                  <p className="text-caption font-semibold uppercase tracking-[0.06em] text-primary">Short answer</p>
                  <p className="mt-2 text-lead leading-relaxed">{p.answer}</p>
                </div>
              )}
              {p.keyPoints.length > 0 && (
                <div id="key-points">
                  <h2>Key points</h2>
                  <ul>
                    {p.keyPoints.map((k, i) => (
                      <li key={`${i}-${k}`}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Markdown blocks={blocks} />
              {faqs.length > 0 && (
                <section id="faq" aria-labelledby="faq-h">
                  <h2 id="faq-h">Frequently asked questions</h2>
                  {faqs.map((f, i) => (
                    <div key={`${i}-${f.q}`}>
                      <h3>{f.q}</h3>
                      <p>{f.a}</p>
                    </div>
                  ))}
                </section>
              )}
            </Prose>
            <p className="mt-10">
              <Link href="/free-check" className={inkPill("lg")}>
                Check your website free
                <ArrowRight aria-hidden />
              </Link>
            </p>
            {known && <AuthorBox author={known} />}
            <RelatedBlock
              title="Related reading"
              items={[
                ...related.map((r) => ({ href: `/blog/${r.slug}`, title: r.title, summary: r.description })),
                ...relatedGuides(p).map((g) => ({ href: `/learn/${g.slug}`, title: g.title, summary: g.description })),
              ].slice(0, 3)}
            />
          </article>
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {toc.length > 0 && (
              <nav aria-label="On this page" className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-caption uppercase tracking-[0.06em] text-muted">On this page</p>
                <ol className="mt-3 space-y-1.5 text-small">
                  {toc.map((h) =>
                    h.t === "h2" ? (
                      <li key={h.id}>
                        <a href={`#${h.id}`} className="text-fg-soft hover:text-fg">
                          {h.text}
                        </a>
                      </li>
                    ) : null,
                  )}
                </ol>
              </nav>
            )}
            {related.length > 0 && (
              <nav aria-label="Related posts" className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-caption uppercase tracking-[0.06em] text-muted">Related</p>
                <ul className="mt-3 space-y-2 text-small">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link href={`/blog/${r.slug}`} className="font-medium text-primary hover:underline">
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>
      </div>
      <FinalCta title="See your SEO, AEO and GEO scores." body={<p>Run the free website check — no sign-up — and get your top fixes in plain words.</p>} />
    </>
  );
}

/** Guides that share a keyword with the post (fills the "Related reading" block when there are few related posts). */
function relatedGuides(p: Pick<BlogPost, "keywords" | "title">) {
  const words = new Set(
    [...p.keywords, p.title]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
  return ARTICLES.map((a) => ({ a, hits: a.keywords.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => words.has(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits)
    .map((x) => x.a)
    .slice(0, 3);
}
