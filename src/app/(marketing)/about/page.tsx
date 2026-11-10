import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/billing/plans";
import { LEGAL_ENTITY } from "@/lib/site";
import { breadcrumbLd, faqLdFromQa, siteUrl, webPageLd } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { ENGINES, FinalCta, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { SERVICE_FROM_PRICE, TRIAL_DAYS, gstOn, inr, inrGst, num } from "@/components/marketing/plans";
import { DifferenceStrip } from "@/components/marketing/showcase/difference-strip";

// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/about");

const engineList = `${ENGINES.slice(0, -1).join(", ")} and ${ENGINES[ENGINES.length - 1]}`;

const MORE: Qa[] = [
  {
    q: "Who writes the MyWebRank guides and blog?",
    a: (
      <>
        The {BRAND.name} team writes our <Link href="/learn">guides</Link> and <Link href="/blog">blog</Link>. We base
        advice on public documentation from search engines and web standards bodies, and on what our own checks find on
        real websites. We avoid made-up statistics: when we quote a number, it comes from our product or a named source.
      </>
    ),
  },
  {
    q: "Does MyWebRank guarantee rankings or AI mentions?",
    a: (
      <>
        No. Nobody controls where Google ranks a page or what an AI assistant says, so we never promise a position. What
        we promise is honest measurement, clear fixes in plain words, and changes that go live on your website only after
        you approve them, with an undo.
      </>
    ),
  },
];

export default function AboutPage() {
  const base = siteUrl();
  const starter = PLANS.starter;
  return (
    <>
      <JsonLd
        data={[
          webPageLd("/about", { type: "AboutPage", name: `About ${BRAND.name}`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } }),
          faqLdFromQa(MORE),
          breadcrumbLd([{ name: "About", path: "/about" }], base),
        ]}
      />
      <PageHero
        eyebrow="About us"
        title={`About ${BRAND.name}`}
        intro={
          <p>
            {BRAND.name} helps businesses get found on Google and named by AI assistants. Here is who we are, what we do,
            how we measure it and how to reach us.
          </p>
        }
      />

      <Section labelledBy="about-different" tone="surface">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="eyebrow mb-3">How we&apos;re different</p>
          <h2 id="about-different" className="text-balance text-h2 text-fg">
            How is {BRAND.name} different?
          </h2>
          <p className="mt-4 text-body leading-relaxed text-fg-soft">
            We explain every problem in plain English, we change your website only after you approve, with an undo, we
            track what AI assistants like {engineList} say about you, and our prices are in Indian rupees, starting at{" "}
            {inrGst(starter.priceInrMonthly ?? 0)} a month.
          </p>
        </div>
        <DifferenceStrip
          caption={`Four things we do differently. The small pictures show what each looks like inside ${BRAND.name}.`}
          items={[
            {
              title: "Plain English, not jargon",
              body: "Every problem comes with what is wrong and the steps to fix it, in words a shop owner can follow.",
              visual: { kind: "plain", before: "Missing meta description", after: "Add a Google summary to 6 pages" },
            },
            {
              title: "Fixes go live only with your OK",
              body: "We draft the change and you approve it first. The old version is saved, so you can undo it any time.",
              visual: { kind: "approve", approve: "Approve", undo: "Undo" },
            },
            {
              title: "AI answers tracked",
              body: `We ask up to ${ENGINES.length} AI assistants your customers' questions and record whether you are named, linked or left out.`,
              visual: { kind: "ai", engines: ENGINES, named: "Named", linked: "Linked", missed: "Left out" },
            },
            {
              title: "Prices in ₹, up front",
              body: gstOn()
                ? `Plans are priced in Indian rupees, with GST shown separately and a ${TRIAL_DAYS}-day free trial first.`
                : `Plans are priced in Indian rupees, with a ${TRIAL_DAYS}-day free trial first.`,
              visual: {
                kind: "inr",
                price: inr(starter.priceInrMonthly ?? 0),
                per: gstOn() ? "+ GST / month" : "/ month",
                notes: [gstOn() ? `${starter.name} plan, GST extra` : `${starter.name} plan`, `${TRIAL_DAYS}-day free trial`],
              },
            },
          ]}
        />
      </Section>

      <Section labelledBy="about-who">
        <div className="mx-auto max-w-3xl space-y-10 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <div>
            <p className="eyebrow mb-3">Who we are</p>
            <h2 id="about-who" className="text-h3 text-fg">
              Who is behind {BRAND.name}?
            </h2>
            <p className="mt-3">
              {BRAND.name} is the SEO, AEO and GEO platform at {BRAND.domain}. It is a product of {LEGAL_ENTITY} and is built
              and run by a team based in India. We make software that audits websites for Google and AI search, and we
              offer a done-for-you service for businesses that would rather have the work done for them.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">What does {BRAND.name} do?</h2>
            <p className="mt-3">
              We check how ready a website is for Google, answer engines and AI assistants, and how often {engineList}{" "}
              mention a brand when customers ask them questions. Then we turn what we find into plain-English fixes and,
              with your approval, publish many of them for you.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-fg">Website audits:</strong> on the {starter.name} plan, each website
                check reads up to {num(starter.maxPagesPerCrawl)} pages; the Growth plan reads up to{" "}
                {num(PLANS.growth.maxPagesPerCrawl)} and the Agency plan up to {num(PLANS.agency.maxPagesPerCrawl)}.
              </li>
              <li>
                <strong className="font-semibold text-fg">AI visibility tracking:</strong> we ask your customers&apos;
                questions to up to {ENGINES.length} AI assistants and record whether you are named, cited or left out.
              </li>
              <li>
                <strong className="font-semibold text-fg">Software plans:</strong> paid plans start at{" "}
                {inrGst(starter.priceInrMonthly ?? 0)} a month, and you can try the product free for {TRIAL_DAYS} days first.
              </li>
              <li>
                <strong className="font-semibold text-fg">Done-for-you service:</strong> our team does the work for you,
                from {inr(SERVICE_FROM_PRICE)} a month excluding GST. See <Link href="/services">services</Link>.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-h3 text-fg">How does {BRAND.name} measure a website?</h2>
            <p className="mt-3">
              We read your pages the way search engines do, follow your robots.txt rules, and score four areas — SEO, AEO,
              GEO and Brand — each from 0 to 100. AI visibility comes from asking assistants real customer questions and
              counting how often you are named and cited. The full method is on{" "}
              <Link href="/how-it-works">how it works</Link>.
            </p>
            <p className="mt-3">
              Our checks follow public guidance rather than guesswork: Google&apos;s{" "}
              <SourceLink href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide">
                SEO Starter Guide
              </SourceLink>
              , the <SourceLink href="https://schema.org/Organization">schema.org vocabulary</SourceLink> for business
              details, and the{" "}
              <SourceLink href="https://datatracker.ietf.org/doc/html/rfc9309">Robots Exclusion Protocol (RFC 9309)</SourceLink>{" "}
              for crawler rules.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">Is {BRAND.name} the same as MyWebRank S.L. or getmywebrank.com?</h2>
            <p className="mt-3">
              No. {BRAND.name} ({BRAND.domain}) is not affiliated with MyWebRank S.L. in Spain or with getmywebrank.com. Our
              website is {BRAND.domain}, and our product is the SEO, AEO and GEO platform and service described on this
              page. If an AI assistant or directory mixes us up with another company, please tell us so we can correct it.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-fg">How can I contact {BRAND.name}?</h2>
            <p className="mt-3">
              Email <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> or use our{" "}
              <Link href="/contact">contact form</Link>. A real person on our team reads every message, whether it is a
              question before you sign up, a request for agency limits or help with a report you already have.
            </p>
          </div>
        </div>
      </Section>

      <QaSection id="about-more" title="More about how we work" tone="surface" items={MORE}>
        <SourcesList
          className="rounded-2xl border border-border bg-bg p-6"
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content", label: "Google Search Central: creating helpful, reliable content" },
            { href: "https://schema.org/AboutPage", label: "schema.org: AboutPage" },
            { href: "https://www.w3.org/TR/json-ld11/", label: "W3C: JSON-LD 1.1", note: "the format we use for structured data" },
          ]}
        />
      </QaSection>

      <FinalCta
        title="See how Google and AI see your website."
        body={<p>Run the free website check — no sign-up — or start a {TRIAL_DAYS}-day free trial.</p>}
      />
    </>
  );
}
