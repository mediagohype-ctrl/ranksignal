import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getArticle } from "@/lib/learn/articles";
import { breadcrumbLd, faqLd, siteUrl } from "@/lib/seo/schema";
import { fitDescription, pageMetadata } from "@/lib/seo/metadata";
import { FinalCta, JsonLd, PageHero, Prose, inkPill } from "@/components/marketing/ui";
import { RichText } from "@/components/marketing/rich-text";

// Rendered per request like the other marketing pages, so schema URLs use APP_URL at runtime and the
// header reflects the visitor's session. Unknown slugs 404.

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
      authors: [`${BRAND.name} team`],
      keywords: a.keywords,
    }),
    authors: [{ name: `${BRAND.name} team`, url: "/" }],
  };
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const base = siteUrl();
  const url = `${base}/learn/${a.slug}`;
  const related = a.related.map(getArticle).filter((r) => r !== undefined);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: a.title,
    description: a.description,
    abstract: a.answer,
    keywords: a.keywords.join(", "),
    datePublished: a.published,
    dateModified: a.updated,
    inLanguage: "en-IN",
    url,
    mainEntityOfPage: url,
    image: `${base}/opengraph-image`,
    author: { "@type": "Organization", "@id": `${base}/#organization`, name: BRAND.name, url: `${base}/` },
    publisher: { "@id": `${base}/#organization` },
    isPartOf: { "@id": `${base}/#website` },
    about: a.keywords.slice(0, 2).map((k) => ({ "@type": "Thing", name: k })),
    // The direct answer + key points are the parts voice assistants / answer engines should read.
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["#answer", "#key-points"] },
  };

  return (
    <>
      <JsonLd
        data={[
          articleLd,
          faqLd(a.faqs),
          breadcrumbLd([{ name: "Guides", path: "/learn" }, { name: a.title, path: `/learn/${a.slug}` }], base),
        ]}
      />
      <PageHero
        eyebrow="Guide"
        title={a.title}
        intro={
          <p>
            By the {BRAND.name} team · Updated <time dateTime={a.updated}>{fmt(a.updated)}</time>
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
            <Link href="/learn" className="hover:text-fg">Guides</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-fg-soft">{a.title}</li>
        </ol>
      </nav>
      <div className="bg-bg py-10 sm:py-14">
        <div className="container-marketing grid gap-10 lg:grid-cols-[1fr_260px] lg:gap-14">
          <article className="min-w-0">
            <Prose>
              <div id="answer" className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-6 text-fg">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-primary">Short answer</p>
                <p className="mt-2 text-lead leading-relaxed">{a.answer}</p>
              </div>
              <div id="key-points">
                <h2>Key points</h2>
                <ul>
                  {a.keyPoints.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
              {a.sections.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                  <h2 id={`${s.id}-h`}>{s.heading}</h2>
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>
                      <RichText text={p} />
                    </p>
                  ))}
                  {s.table && (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[640px] border-collapse text-left text-small">
                        <thead className="bg-surface-2 text-fg">
                          <tr>
                            {s.table.head.map((h, i) => (
                              <th key={i} scope="col" className="px-4 py-3 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((r, i) => (
                            <tr key={i} className="border-t border-border align-top">
                              {r.map((c, j) =>
                                j === 0 ? (
                                  <th key={j} scope="row" className="px-4 py-3 font-semibold text-fg">
                                    {c}
                                  </th>
                                ) : (
                                  <td key={j} className="px-4 py-3">
                                    {c}
                                  </td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {s.bullets && (
                    <ul>
                      {s.bullets.map((b, i) => (
                        <li key={i}>
                          <RichText text={b} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.steps && (
                    <ol>
                      {s.steps.map((b, i) => (
                        <li key={i}>
                          <RichText text={b} />
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ))}
              <section id="faq" aria-labelledby="faq-h">
                <h2 id="faq-h">Frequently asked questions</h2>
                {a.faqs.map((f) => (
                  <div key={f.q}>
                    <h3>{f.q}</h3>
                    <p>{f.a}</p>
                  </div>
                ))}
              </section>
              {a.sources.length > 0 && (
                <section id="sources" aria-labelledby="sources-h">
                  <h2 id="sources-h">Sources</h2>
                  <ul>
                    {a.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} rel="noopener">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </Prose>
            <p className="mt-10">
              <Link href={a.cta.href} className={inkPill("lg")}>
                {a.cta.label}
                <ArrowRight aria-hidden />
              </Link>
            </p>
          </article>
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">On this page</p>
              <ol className="mt-3 space-y-1.5 text-small">
                {a.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-fg-soft hover:text-fg">
                      {s.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="#faq" className="text-fg-soft hover:text-fg">
                    FAQ
                  </a>
                </li>
                {a.sources.length > 0 && (
                  <li>
                    <a href="#sources" className="text-fg-soft hover:text-fg">
                      Sources
                    </a>
                  </li>
                )}
              </ol>
            </nav>
            {related.length > 0 && (
              <nav aria-label="Related guides" className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-caption uppercase tracking-[0.06em] text-muted">Related guides</p>
                <ul className="mt-3 space-y-2 text-small">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/learn/${r.slug}`} className="font-medium text-primary hover:underline">
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
      <FinalCta
        title="See your SEO, AEO and GEO scores."
        body={<p>Run the free website check — no sign-up — and get your top fixes in plain words.</p>}
      />
    </>
  );
}
