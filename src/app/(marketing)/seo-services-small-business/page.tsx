import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShoppingBag, Stethoscope, Store, UtensilsCrossed, Wrench } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND, bookCallHref } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, type Qa } from "@/components/marketing/answers";
import { ServicesCta } from "@/components/marketing/services-ui";
import {
  CUSTOM_CONTACT_HREF, DFY_PLAN, SELF_PLAN, TRIAL_DAYS, gstOn, inr, newTabProps, num, priceNote, servicesContactHref,
} from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, siteUrl, webPageLd } from "@/lib/seo/schema";

const PATH = "/seo-services-small-business" as const;

export const metadata: Metadata = staticPageMetadata(PATH);

const GST = gstOn() ? " + GST" : "";
const CALL_HREF = bookCallHref(servicesContactHref());

const WAYS = [
  {
    step: "Start here",
    name: "Free website check",
    price: "Free",
    priceNote: "No sign-up",
    body: "Type your website address. In about 30 seconds you see your score out of 100, how ready your website is for Google and AI assistants, and the most important fixes.",
    href: "/free-check",
    cta: "Check my website free",
  },
  {
    step: "Do it yourself",
    name: SELF_PLAN.name,
    price: inr(SELF_PLAN.price),
    priceNote: `a month${GST}`,
    body: `Our SEO audit software checks up to ${num(SELF_PLAN.limits.maxPagesPerCrawl)} pages every week, asks ChatGPT, Gemini and Perplexity about you, and gives you a to-do list in plain words. You or your web person make the fixes. ${TRIAL_DAYS}-day free trial, no card needed.`,
    href: "/pricing",
    cta: "See the software",
  },
  {
    step: "We do it for you",
    name: DFY_PLAN.name,
    price: inr(DFY_PLAN.price),
    priceNote: `a month${GST}`,
    body: `Our team does the work every month and sends you a report. No setup fee. ${DFY_PLAN.minimumMonths} months to start, then month to month.`,
    href: "/done-for-you",
    cta: "See Do it for me",
  },
];

const SUITS = [
  { icon: Store, title: "Local shops", body: "People search “near me” and ask AI which shop to visit. Your hours, address and photos need to be right everywhere." },
  { icon: Stethoscope, title: "Clinics", body: "Patients compare doctors before they call. Clear pages about your treatments, timings and location help them choose you." },
  { icon: UtensilsCrossed, title: "Restaurants and cafes", body: "Your Google Business Profile, menu and reviews decide a lot. We keep them complete and up to date." },
  { icon: Wrench, title: "Service firms", body: "CAs, lawyers, interior designers, repair services. Pages that answer real customer questions bring calls." },
  { icon: ShoppingBag, title: "Online stores", body: "Product and category pages that Google can read, load fast and answer what buyers ask before they buy." },
];

const DIFFERENT = [
  {
    title: "Plain words, not jargon",
    body: "Every problem and every report is written for a business owner. Where an expert term helps, we explain it.",
  },
  {
    title: "Google and AI assistants",
    body: "We check how ChatGPT, Gemini and Perplexity answer your customers' questions, not only your Google position.",
  },
  {
    title: "You approve every change",
    body: "Anything that changes what your business says in public waits for your OK. You get a list of every edit we make.",
  },
  {
    title: "No ranking promises",
    body: "Nobody controls Google or AI answers. We promise the work, and our monthly report shows honestly what it moved and what it didn't.",
  },
];

const FAQ: Qa[] = [
  {
    q: "How much do SEO services for small businesses cost in India?",
    a: (
      <>
        With {BRAND.name}, the website check is free. Our software, {SELF_PLAN.name}, costs {inr(SELF_PLAN.price)} a month{GST}. Our team&apos;s{" "}
        {DFY_PLAN.name} service costs {inr(DFY_PLAN.price)} a month{GST}, with no setup fee. For a wider view of prices, read our guide to{" "}
        <Link href="/learn/seo-audit-cost-india">SEO audit cost in India</Link>.
      </>
    ),
  },
  {
    q: "Do you guarantee a first-page Google ranking?",
    a: (
      <>
        No. Nobody controls what Google or AI assistants show, and anyone who guarantees a position is guessing. We promise the work: we fix what
        holds your website back, every month, and show you honestly what changed.
      </>
    ),
  },
  {
    q: "What is the difference between your SEO audit software and the service?",
    a: (
      <>
        With {SELF_PLAN.name}, our software finds the problems and explains each fix in plain words, and you make the changes. With {DFY_PLAN.name},
        our team makes the changes for you, looks after your Google Business Profile and listings, and sends a monthly report. Both include the live
        dashboard.
      </>
    ),
  },
  {
    q: "How long until I see results?",
    a: (
      <>
        Simple fixes, like a missing page summary or wrong business hours, can show up within weeks. Bigger changes, like new pages that answer
        customer questions, usually take a few months. That is why {DFY_PLAN.name} starts with {DFY_PLAN.minimumMonths} months, then runs month to
        month.
      </>
    ),
  },
  {
    q: "Do I need a big website to start?",
    a: (
      <>
        No. A small website with a few pages is fine, and so is a business that mostly lives on its Google Business Profile. Start with the{" "}
        <Link href="/free-check">free website check</Link> to see where you stand.
      </>
    ),
  },
];

export default function SeoServicesSmallBusinessPage() {
  const base = siteUrl();
  const url = `${base}${PATH}`;
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: PAGE_SEO[PATH].title,
            serviceType: "SEO services for small businesses",
            description: PAGE_SEO[PATH].description,
            url,
            areaServed: { "@type": "Country", name: "India" },
            provider: { "@type": "Organization", "@id": `${base}/#organization`, name: BRAND.name, url: base },
            offers: [
              {
                "@type": "Offer",
                name: `${SELF_PLAN.name} (SEO audit software)`,
                url: `${base}/pricing`,
                priceCurrency: "INR",
                price: String(SELF_PLAN.price),
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  price: String(SELF_PLAN.price),
                  priceCurrency: "INR",
                  unitCode: "MON",
                  valueAddedTaxIncluded: false,
                },
              },
              {
                "@type": "Offer",
                name: `${DFY_PLAN.name} (done-for-you)`,
                url: `${base}/done-for-you#plans`,
                priceCurrency: "INR",
                price: String(DFY_PLAN.price),
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  price: String(DFY_PLAN.price),
                  priceCurrency: "INR",
                  unitCode: "MON",
                  valueAddedTaxIncluded: false,
                },
              },
            ],
          },
          webPageLd(PATH, { base }),
          faqLdFromQa(FAQ),
          breadcrumbLd([{ name: "SEO services for small businesses", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="SEO for small businesses"
        title="SEO services for small businesses in India"
        intro={
          <p>
            Get found when customers search on Google or ask ChatGPT. Start with a free check, fix things yourself with our software, or let our
            team do the work. You approve every change.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <LinkButton href="/free-check" size="lg" variant="accent" iconRight={<ArrowRight />}>
            Check my website free
          </LinkButton>
          <Link href="/pricing" className="text-body font-medium text-navy-fg underline decoration-navy-fg/40 underline-offset-4 hover:decoration-navy-fg">
            See prices
          </Link>
        </div>
      </PageHero>

      {/* ------------------------------------------------------------ The problem */}
      <Section labelledBy="ssb-problem">
        <div className="mx-auto max-w-3xl space-y-5 text-body leading-relaxed text-fg-soft">
          <h2 id="ssb-problem" className="text-h2 text-fg">
            The problem, in plain words
          </h2>
          <p>
            Your customers are looking for you right now. They type &quot;dentist near me&quot; into Google, or ask ChatGPT &quot;which bakery in
            Indiranagar is good?&quot;. If your website is hard for Google to read, your business details are different on every listing, or your
            pages don&apos;t answer what people ask, they find someone else.
          </p>
          <p>
            Most small business owners don&apos;t have the time to learn SEO, and many have paid an agency without ever seeing what was done. And
            now there is a second place to be found: AI assistants, which write one answer and name only a few businesses.
          </p>
          <p>
            We keep it simple. We check your website and what AI says about you, tell you what to fix first, and either help you do it or do it for
            you.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------ 3 ways */}
      <Section labelledBy="ssb-ways" tone="surface">
        <div className="max-w-3xl">
          <h2 id="ssb-ways" className="text-h2 text-fg">
            Three ways to work with us
          </h2>
          <p className="mt-4 text-lead text-fg-soft">Start free. Move up only when it makes sense for you.</p>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {WAYS.map((w, i) => (
            <li key={w.name} className="mk-reveal flex flex-col rounded-2xl border border-border bg-bg p-6 sm:p-7">
              <p className="text-small font-medium text-primary">
                {String(i + 1).padStart(2, "0")} · {w.step}
              </p>
              <h3 className="mt-3 text-h4 text-fg">{w.name}</h3>
              <p className="mt-2 text-h3 text-fg">
                {w.price}
                <span className="text-small font-normal text-muted"> {w.priceNote}</span>
              </p>
              <p className="mt-3 flex-1 text-body leading-relaxed text-fg-soft">{w.body}</p>
              <p className="mt-5">
                <Link href={w.href} className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
                  {w.cta}
                  <ArrowRight aria-hidden size={16} />
                </Link>
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl text-small text-muted">
          {priceNote()} Many websites or brands?{" "}
          <a
            href={CUSTOM_CONTACT_HREF}
            {...newTabProps(CUSTOM_CONTACT_HREF)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Talk to us about a Custom plan
          </a>
          .
        </p>
      </Section>

      {/* ------------------------------------------------------------ What we do each month */}
      <Section labelledBy="ssb-monthly">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <h2 id="ssb-monthly" className="text-h2 text-fg">
              What our team does each month
            </h2>
            <p className="mt-4 text-lead text-fg-soft">
              On {DFY_PLAN.name}, for {inr(DFY_PLAN.price)} a month{GST}. {DFY_PLAN.inherits}.
            </p>
            <p className="mt-6">
              <Link href="/done-for-you" className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
                See how the service works
                <ArrowRight aria-hidden size={16} />
              </Link>
            </p>
          </div>
          <ul className="space-y-3 lg:col-span-7">
            {DFY_PLAN.includes.map((i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-4 text-body text-fg-soft">
                <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Who it suits */}
      <Section labelledBy="ssb-suits" tone="surface">
        <div className="max-w-3xl">
          <h2 id="ssb-suits" className="text-h2 text-fg">
            Who it suits
          </h2>
          <p className="mt-4 text-lead text-fg-soft">Small businesses whose customers search before they call, visit or buy.</p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SUITS.map((s) => (
            <li key={s.title} className="mk-reveal rounded-2xl border border-border bg-bg p-6">
              <div className="flex items-center gap-4">
                <IconTile>
                  <s.icon />
                </IconTile>
                <h3 className="text-h4 text-fg">{s.title}</h3>
              </div>
              <p className="mt-4 text-body leading-relaxed text-fg-soft">{s.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ How we're different */}
      <Section labelledBy="ssb-different">
        <div className="max-w-3xl">
          <h2 id="ssb-different" className="text-h2 text-fg">
            How we are different
          </h2>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {DIFFERENT.map((d) => (
            <li key={d.title} className="border-t border-fg pt-5">
              <h3 className="text-h4 text-fg">{d.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-fg-soft">{d.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-3xl text-body text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          Want to see what AI says about you first? Try the free <Link href="/tools/ai-visibility-checker">AI visibility checker</Link>, then read{" "}
          <Link href="/learn/improve-ai-search-visibility">how to improve your AI search visibility</Link>. Comparing bigger tools? See our list of{" "}
          <Link href="/compare/semrush-alternatives">Semrush alternatives</Link>.
        </p>
      </Section>

      <QaSection id="ssb-faq" tone="surface" title="Questions small business owners ask" items={FAQ} />

      <ServicesCta
        title="See what to fix first. Free."
        body={
          <p>
            Run the free website check, or book a free 30-minute call and we&apos;ll look at your website and AI answers with you.
          </p>
        }
        primary={{ href: "/free-check", label: "Check my website free" }}
        secondary={{ href: CALL_HREF, label: "Book a free call" }}
        footnote={`${priceNote()} We promise the work, never a Google or AI position.`}
      />
    </>
  );
}
