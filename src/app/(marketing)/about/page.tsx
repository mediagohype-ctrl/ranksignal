import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { breadcrumbLd, siteUrl, webPageLd } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/marketing/ui";
import { AboutBody, type AboutCopy } from "@/components/marketing/about-ui";
import { CUSTOM_PLAN, DFY_PLAN } from "@/components/marketing/plans";

// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/about");

// About page (Full Site Audit, 15 Nov 2026): headline, the proof line, a 3-line story, 3 beliefs and one button.
// "A product of Go Hype Media" is one small grey line at the bottom, with the GST number when it is configured.
const COPY: AboutCopy = {
  eyebrow: "About us",
  title: "We help businesses get found.",
  proof: BRAND.proof,
  storyTitle: "Why we built it",
  story: [
    "People now ask Google and AI tools like ChatGPT who to buy from.",
    "Most business owners can't tell whether they show up, or what to change.",
    `${BRAND.name} checks your website and shows what to fix, in plain words. If you'd rather not do it yourself, our team in India does it for you.`,
  ],
  beliefsTitle: "Three things we believe",
  beliefs: [
    { title: "Plain words", body: "Every problem comes with what is wrong and how to fix it, in words a shop owner can follow." },
    { title: "Honest numbers", body: "Nobody controls Google or AI answers, so we never promise a position. We measure, and show you what changed." },
    {
      title: "You stay in charge",
      body: `Nothing changes on your website without your OK. You make the fixes with our steps, or our team makes them on ${DFY_PLAN.name}.`,
    },
  ],
  ctaTitle: "See how Google and AI see your business.",
  cta: { label: "Check my website free", href: "/free-check" },
  contact: { before: `A question, a ${CUSTOM_PLAN.name} plan or help with your report? `, label: "Talk to a real person", href: "/contact", after: "." },
  productOf: (brand, legalName) => `${brand} is a product of ${legalName}.`,
  gstLabel: "GST number",
  officeLabel: "Office",
  notRelated: `${BRAND.name} (${BRAND.domain}) is not connected to MyWebRank S.L. in Spain or to getmywebrank.com.`,
};

export default function AboutPage() {
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={[
          webPageLd("/about", { type: "AboutPage", name: `About ${BRAND.name}`, base, extra: { mainEntity: { "@id": `${base}/#organization` } } }),
          breadcrumbLd([{ name: "About", path: "/about" }], base),
        ]}
      />
      <AboutBody copy={COPY} />
    </>
  );
}
