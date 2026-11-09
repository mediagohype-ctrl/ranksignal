import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { ARTICLES } from "@/lib/learn/articles";
import { breadcrumbLd, siteUrl } from "@/lib/seo/schema";
import { JsonLd, PageHero } from "@/components/marketing/ui";

const TITLE = "SEO, AEO & GEO guides: rank on Google and in AI answers";
const DESCRIPTION =
  "Free, plain-English guides to SEO, AEO (answer engine optimization) and GEO (generative engine optimization): how to rank on Google, get quoted in AI Overviews and get your business mentioned by ChatGPT.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn" },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: "/learn", siteName: BRAND.name, type: "website" },
};

export default function LearnPage() {
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: TITLE,
            description: DESCRIPTION,
            url: `${base}/learn`,
            isPartOf: { "@id": `${base}/#website` },
            publisher: { "@id": `${base}/#organization` },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: ARTICLES.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/learn/${a.slug}`, name: a.title })),
            },
          },
          breadcrumbLd([{ name: "Guides", path: "/learn" }], base),
        ]}
      />
      <PageHero
        eyebrow="Guides"
        title="SEO, AEO and GEO guides"
        intro={<p>Plain-English guides to getting found on Google, quoted by answer engines and recommended by AI assistants like ChatGPT.</p>}
      />
      <section className="bg-bg py-12 sm:py-16">
        <ul className="container-marketing grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/learn/${a.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-card transition-colors hover:border-border-strong"
              >
                <h2 className="text-h4 text-fg">{a.title}</h2>
                <p className="mt-3 flex-1 text-small leading-relaxed text-fg-soft">{a.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-small font-medium text-primary">
                  Read the guide <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
