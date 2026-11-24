// The guide page body shared by /learn/[slug] (English) and /hi/learn/[slug] (Hindi): answer-first layout with
// byline, key points, sections, FAQ, sources, author box and related guides (SEO fix brief P4, P8).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Article } from "@/lib/learn/articles";
import { DEFAULT_AUTHOR } from "@/lib/authors";
import { AuthorBox, Byline, RelatedBlock, personLd } from "@/components/marketing/article-parts";
import { breadcrumbLd, faqLd, siteUrl } from "@/lib/seo/schema";
import { FinalCta, JsonLd, PageHero, Prose, inkPill } from "@/components/marketing/ui";
import { RichText } from "@/components/marketing/rich-text";

const LABELS = {
  en: {
    basePath: "/learn", homeHref: "/", guidesHref: "/learn", inLanguage: "en-IN",
    guide: "Guide", home: "Home", guides: "Guides", shortAnswer: "Short answer", keyPoints: "Key points",
    faq: "Frequently asked questions", faqShort: "FAQ", sources: "Sources", onThisPage: "On this page", related: "Related guides",
    ctaTitle: "See your SEO, AEO and GEO scores.",
    ctaBody: "Run the free website check — no sign-up — and get your top fixes in plain words.",
  },
  hi: {
    basePath: "/hi/learn", homeHref: "/hi", guidesHref: "/hi", inLanguage: "hi-IN",
    guide: "गाइड", home: "होम", guides: "हिन्दी", shortAnswer: "छोटा जवाब", keyPoints: "मुख्य बातें",
    faq: "अक्सर पूछे जाने वाले सवाल", faqShort: "सवाल-जवाब", sources: "स्रोत", onThisPage: "इस पेज पर", related: "और गाइड",
    ctaTitle: "अपने SEO, AEO और GEO स्कोर देखें।",
    ctaBody: "फ्री वेबसाइट चेक चलाएँ — साइन-अप की ज़रूरत नहीं — और आसान शब्दों में अपने सबसे ज़रूरी सुधार पाएँ।",
  },
} as const;

/** One guide page (English /learn/… or Hindi /hi/learn/…): answer, key points, sections, FAQ, sources, author, related. */
export function ArticleView({ a, related, lang = "en" }: { a: Article; related: Article[]; lang?: "en" | "hi" }) {
  const L = LABELS[lang];
  const base = siteUrl();
  const path = `${L.basePath}/${a.slug}`;
  const url = `${base}${path}`;

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
    inLanguage: L.inLanguage,
    url,
    mainEntityOfPage: url,
    image: `${base}/opengraph-image`,
    author: personLd(DEFAULT_AUTHOR, base),
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
          breadcrumbLd([{ name: L.guides, path: L.guidesHref }, { name: a.title, path }], base),
        ]}
      />
      <PageHero
        eyebrow={L.guide}
        title={a.title}
        intro={<Byline author={DEFAULT_AUTHOR} updated={a.updated} lang={lang} />}
      />
      <nav aria-label="Breadcrumb" className="container-marketing pt-6 text-small text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={L.homeHref} className="hover:text-fg">{L.home}</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={L.guidesHref} className="hover:text-fg">{L.guides}</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-fg-soft">{a.title}</li>
        </ol>
      </nav>
      <div className="bg-bg py-10 sm:py-14">
        <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px] lg:gap-14">
          <article className="min-w-0">
            <Prose>
              <div id="answer" className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-6 text-fg">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-primary">{L.shortAnswer}</p>
                <p className="mt-2 text-lead leading-relaxed">{a.answer}</p>
              </div>
              <div id="key-points">
                <h2>{L.keyPoints}</h2>
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
                <h2 id="faq-h">{L.faq}</h2>
                {a.faqs.map((f) => (
                  <div key={f.q}>
                    <h3>{f.q}</h3>
                    <p>{f.a}</p>
                  </div>
                ))}
              </section>
              {a.sources.length > 0 && (
                <section id="sources" aria-labelledby="sources-h">
                  <h2 id="sources-h">{L.sources}</h2>
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
            <AuthorBox author={DEFAULT_AUTHOR} lang={lang} />
            <RelatedBlock title={L.related} items={related.map((r) => ({ href: `${L.basePath}/${r.slug}`, title: r.title, summary: r.description }))} />
          </article>
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">{L.onThisPage}</p>
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
                    {L.faqShort}
                  </a>
                </li>
                {a.sources.length > 0 && (
                  <li>
                    <a href="#sources" className="text-fg-soft hover:text-fg">
                      {L.sources}
                    </a>
                  </li>
                )}
              </ol>
            </nav>
            {related.length > 0 && (
              <nav aria-label="Related guides" className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-caption uppercase tracking-[0.06em] text-muted">{L.related}</p>
                <ul className="mt-3 space-y-2 text-small">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`${L.basePath}/${r.slug}`} className="font-medium text-primary hover:underline">
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
      <FinalCta title={L.ctaTitle} body={<p>{L.ctaBody}</p>} />
    </>
  );
}
