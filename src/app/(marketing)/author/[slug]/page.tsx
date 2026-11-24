// Author pages (/author/<slug>, SEO fix brief P4): who writes the guides — photo or initials, bio, topics and every
// guide they wrote, with schema.org ProfilePage + Person. Facts come from src/lib/authors.ts only.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AUTHORS, authorUrl } from "@/lib/authors";
import { ARTICLES } from "@/lib/learn/articles";
import { HINDI_ARTICLES } from "@/lib/learn/hi";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { personLd } from "@/components/marketing/article-parts";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, siteUrl } from "@/lib/seo/schema";
import type { StaticPath } from "@/lib/seo/pages";

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(AUTHORS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return AUTHORS[slug] ? staticPageMetadata(authorUrl(slug) as StaticPath) : {};
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = AUTHORS[slug];
  if (!author) notFound();
  const base = siteUrl();
  const path = authorUrl(slug);
  // Every guide is credited to the default author (src/components/marketing/article-view.tsx).
  const guides = [
    ...ARTICLES.map((a) => ({ href: `/learn/${a.slug}`, title: a.title, summary: a.description, updated: a.updated, lang: "en" })),
    ...HINDI_ARTICLES.map((a) => ({ href: `/hi/learn/${a.slug}`, title: a.title, summary: a.description, updated: a.updated, lang: "hi" })),
  ].sort((x, y) => y.updated.localeCompare(x.updated));
  const initials = author.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "@id": `${base}${path}#page`,
            url: `${base}${path}`,
            name: `${author.name} · ${BRAND.name}`,
            mainEntity: personLd(author, base),
            hasPart: guides.slice(0, 20).map((g) => ({ "@type": "Article", headline: g.title, url: `${base}${g.href}` })),
          },
          breadcrumbLd([{ name: "Guides", path: "/learn" }, { name: author.name, path }], base),
        ]}
      />
      <PageHero
        eyebrow="Author"
        title={author.name}
        intro={
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {author.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.photo} alt={author.name} width={96} height={96} className="size-24 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="inline-flex size-24 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white">
                {initials}
              </span>
            )}
            <p>{author.role}</p>
          </div>
        }
      />
      <Section labelledBy="author-about">
        <div className="mx-auto max-w-3xl space-y-4 text-body leading-relaxed text-fg-soft">
          <h2 id="author-about" className="text-h3 text-fg">
            About {author.name.split(" ")[0]}
          </h2>
          {author.bio.map((b) => (
            <p key={b}>{b}</p>
          ))}
          <p>
            Every guide is checked against official sources (Google Search Central, schema.org and the AI companies&apos; own
            documentation), written in plain words for business owners, and updated when the facts change. See{" "}
            <Link href="/about" className="font-medium text-primary underline-offset-4 hover:underline">
              about {BRAND.name}
            </Link>{" "}
            for the company behind it.
          </p>
          <h3 className="pt-2 text-h4 text-fg">Writes about</h3>
          <ul className="flex flex-wrap gap-2">
            {author.knowsAbout.map((k) => (
              <li key={k} className="rounded-full border border-border bg-surface px-3 py-1.5 text-small text-fg-soft">
                {k}
              </li>
            ))}
          </ul>
          {author.sameAs.length > 0 && (
            <p className="flex flex-wrap gap-4 pt-2">
              {author.sameAs.map((u) => (
                <a key={u} href={u} rel="me noopener" className="font-medium text-primary underline-offset-4 hover:underline">
                  {/linkedin/i.test(u) ? "LinkedIn" : /x\.com|twitter/i.test(u) ? "X" : new URL(u).hostname}
                </a>
              ))}
            </p>
          )}
        </div>
      </Section>
      <Section labelledBy="author-guides" tone="surface">
        <div className="mx-auto max-w-4xl">
          <h2 id="author-guides" className="text-h3 text-fg">
            Guides by {author.name}
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guides.map((g) => (
              <li key={g.href}>
                <Link href={g.href} lang={g.lang === "hi" ? "hi" : undefined} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-card hover:shadow-card-hover">
                  <span className="text-body font-semibold leading-snug text-fg group-hover:text-primary">{g.title}</span>
                  <span className="mt-1.5 line-clamp-2 text-small text-muted">{g.summary}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-small font-semibold text-primary">
                    Read
                    <ArrowRight aria-hidden size={15} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}
