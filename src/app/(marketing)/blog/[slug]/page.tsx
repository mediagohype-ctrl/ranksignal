import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { BlogPost } from "@prisma/client";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { loadStaff } from "@/lib/admin/guard";
import { faqsOf, publishedPost, publishedPosts } from "@/lib/content/posts";
import { parseMarkdown, plainText, wordCount } from "@/lib/content/markdown";
import { breadcrumbLd, faqLd, siteUrl } from "@/lib/seo/schema";
import { FinalCta, JsonLd, PageHero, Prose, inkPill } from "@/components/marketing/ui";
import { Markdown } from "@/components/marketing/markdown";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Published post, or — for staff with content.view and ?preview=1 — any post (drafts are never indexable). */
async function load(slug: string, preview: boolean): Promise<{ post: BlogPost; isPreview: boolean } | null> {
  const live = await publishedPost(slug);
  if (live && !preview) return { post: live, isPreview: false };
  if (preview) {
    const staff = await loadStaff().catch(() => null);
    if (staff?.can("content.view")) {
      const any = await db.blogPost.findUnique({ where: { slug } }).catch(() => null);
      if (any) return { post: any, isPreview: any.status !== "published" };
    }
  }
  return live ? { post: live, isPreview: false } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await load(slug, (await searchParams).preview === "1");
  if (!r) return {};
  const p = r.post;
  const path = `/blog/${p.slug}`;
  const title = p.metaTitle || p.title;
  return {
    title,
    description: p.description,
    keywords: p.keywords,
    alternates: { canonical: path },
    authors: [{ name: p.authorName }],
    robots: r.isPreview || p.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description: p.description,
      url: path,
      siteName: BRAND.name,
      type: "article",
      publishedTime: p.publishedAt?.toISOString(),
      modifiedTime: p.updatedAt.toISOString(),
      authors: [p.authorName],
      ...(p.coverImageUrl ? { images: [{ url: p.coverImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description: p.description, ...(p.coverImageUrl ? { images: [p.coverImageUrl] } : {}) },
  };
}

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export default async function BlogPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const r = await load(slug, (await searchParams).preview === "1");
  if (!r) notFound();
  const { post: p, isPreview } = r;
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
    author: { "@type": "Person", name: p.authorName, worksFor: { "@id": `${base}/#organization` } },
    publisher: { "@id": `${base}/#organization` },
    isPartOf: { "@id": `${base}/blog#blog` },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["#answer", "#key-points"] },
  };

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
          <p>
            By {p.authorName} · {p.publishedAt ? <time dateTime={p.publishedAt.toISOString()}>{fmt(p.publishedAt)}</time> : "Not published"}
            {p.publishedAt && p.updatedAt.getTime() - p.publishedAt.getTime() > 86_400_000 && (
              <> · Updated <time dateTime={p.updatedAt.toISOString()}>{fmt(p.updatedAt)}</time></>
            )}{" "}
            · {Math.max(1, Math.round(words / 220))} min read
          </p>
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
        <div className="container-marketing grid gap-10 lg:grid-cols-[1fr_260px] lg:gap-14">
          <article className="min-w-0">
            {p.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverImageUrl} alt="" className="mb-8 w-full rounded-2xl border border-border" />
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
                    {p.keyPoints.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Markdown blocks={blocks} />
              {faqs.length > 0 && (
                <section id="faq" aria-labelledby="faq-h">
                  <h2 id="faq-h">Frequently asked questions</h2>
                  {faqs.map((f) => (
                    <div key={f.q}>
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
